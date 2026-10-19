import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Hash, Volume2, ChevronDown, ChevronRight, UserPlus, Settings, Mic, Headphones,
  Users, Pin, BellOff, Search, Plus, Compass, Smile, PlusCircle, LogOut, Copy, MicOff, HeadphoneOff, PhoneOff,
  Video, VideoOff, MonitorUp, MonitorOff, Pencil, Trash2, UserMinus,
} from 'lucide-react'
import {
  api, connectSocket, getToken, setToken, ApiError,
  type Bootstrap, type Channel, type Member, type Message, type ServerEvent,
} from './api'
import Login from './Login'
import VoiceRoom from './VoiceRoom'
import AudioSettings from './AudioSettings'
import VolumeMenu, { type VolumeTarget } from './VolumeMenu'
import { useVoice } from './voice'

type Theme = 'dark' | 'darker' | 'midnight' | 'light'
type Density = 'default' | 'cozy' | 'compact'

interface Menu { x: number; y: number; channel: Channel }
type Dialog =
  | { kind: 'create-server' }
  | { kind: 'join-server' }
  | { kind: 'create-channel'; voice: boolean }
  | { kind: 'invite'; code: string }
  | { kind: 'edit-channel'; channel: Channel; askDelete?: boolean }
  | { kind: 'edit-server'; id: number; name: string; askDelete?: boolean }
  | { kind: 'remove-member'; serverId: number; member: Member }
  | { kind: 'leave-server'; id: number; name: string }

const read = <T extends string>(k: string, fallback: T): T => {
  try { return (localStorage.getItem(k) as T) || fallback } catch { return fallback }
}
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem storage */ } }

function formatTime(ts: number) {
  const d = new Date(ts)
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return `Hoje às ${hm}`
  if (days === 1) return `Ontem às ${hm}`
  return `${d.toLocaleDateString('pt-BR')} ${hm}`
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken())
  return authed
    ? <Chat onLogout={() => { setToken(null); setAuthed(false) }} />
    : <Login onDone={() => setAuthed(true)} />
}

function Chat({ onLogout }: { onLogout: () => void }) {
  const [theme, setTheme] = useState<Theme>(() => read('papo.theme', 'dark'))
  const [density, setDensity] = useState<Density>(() => read('papo.density', 'default'))
  const [data, setData] = useState<Bootstrap | null>(null)
  const [serverId, setServerId] = useState<number | null>(null)
  const [channelId, setChannelId] = useState<number | null>(null)
  const [msgs, setMsgs] = useState<Record<number, Message[]>>({})
  const [unread, setUnread] = useState<Set<number>>(new Set())
  const [typing, setTyping] = useState<Record<number, Record<number, number>>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showMembers, setShowMembers] = useState(true)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [serverMenu, setServerMenu] = useState(false)
  const [memberMenu, setMemberMenu] = useState<{ x: number; y: number; member: Member } | null>(null)
  const [audioOpen, setAudioOpen] = useState(false)
  const [volMenu, setVolMenu] = useState<VolumeTarget | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState('')
  const [connected, setConnected] = useState(false)
  const [view, setView] = useState<'text' | 'voice'>('text')
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const socket = useRef<ReturnType<typeof connectSocket> | null>(null)
  const channelRef = useRef<number | null>(null)
  channelRef.current = channelId

  const server = data?.servers.find((s) => s.id === serverId) ?? null
  const channel = useMemo(
    () => server?.categories.flatMap((c) => c.channels).find((c) => c.id === channelId) ?? null,
    [server, channelId],
  )
  const memberById = useCallback(
    (id: number): Member | undefined => server?.members.find((m) => m.id === id),
    [server],
  )

  const flash = useCallback((text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 5000)
  }, [])

  const sendWs = useCallback((payload: unknown) => { socket.current?.send(payload) }, [])
  const voice = useVoice({ send: sendWs, onError: flash })
  const resyncRef = useRef(voice.resync)
  resyncRef.current = voice.resync
  const inVoiceView = view === 'voice' && voice.channelId !== null
  const voiceChannel = useMemo(
    () => data?.servers.flatMap((s) => s.categories.flatMap((c) => c.channels)).find((c) => c.id === voice.channelId) ?? null,
    [data, voice.channelId],
  )

  function openVoice(ch: Channel) {
    if (!data?.voiceEnabled) return flash('Voz e vídeo não estão ativos neste servidor.')
    setView('voice')
    if (voice.channelId !== ch.id) voice.join(ch.id)
  }

  const refresh = useCallback(async () => {
    try {
      const d = await api.bootstrap()
      // você mesmo está online (a presença pode chegar depois do carregamento)
      d.servers.forEach((sv) => sv.members.forEach((m) => { if (m.id === d.me.id) m.status = 'online' }))
      setData(d)
      setServerId((cur) => (cur && d.servers.some((s) => s.id === cur) ? cur : d.servers[0]?.id ?? null))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onLogout()
    }
  }, [onLogout])

  const loadMessages = useCallback(async (id: number) => {
    try {
      const list = await api.messages(id)
      setMsgs((m) => ({ ...m, [id]: list }))
    } catch { /* canal removido ou sem acesso */ }
  }, [])

  // tema e densidade
  useEffect(() => {
    document.documentElement.className = `theme-${theme} density-${density}`
    write('papo.theme', theme)
    write('papo.density', density)
  }, [theme, density])

  // dados iniciais + websocket
  useEffect(() => {
    refresh()
    const onEvent = (e: ServerEvent) => {
      if (e.t === 'message') {
        const m = e.message
        setMsgs((cur) => cur[m.channelId] ? { ...cur, [m.channelId]: [...cur[m.channelId], m] } : cur)
        setTyping((t) => {
          const ch = { ...t[m.channelId] }
          delete ch[m.authorId]
          return { ...t, [m.channelId]: ch }
        })
        if (m.channelId !== channelRef.current) setUnread((u) => new Set(u).add(m.channelId))
      } else if (e.t === 'presence') {
        setData((d) => d && {
          ...d,
          servers: d.servers.map((s) => ({
            ...s, members: s.members.map((x) => (x.id === e.userId ? { ...x, status: e.status } : x)),
          })),
        })
      } else if (e.t === 'typing') {
        setTyping((t) => ({ ...t, [e.channelId]: { ...t[e.channelId], [e.userId]: Date.now() + 4000 } }))
      } else if (e.t === 'voice') {
        setData((d) => d && {
          ...d,
          servers: d.servers.map((s) => (e.channelId in s.voice ? { ...s, voice: { ...s.voice, [e.channelId]: e.users } } : s)),
        })
      } else if (e.t === 'removed') {
        flash(e.kicked ? `Você foi removido do servidor ${e.serverName}.` : `Você saiu do servidor ${e.serverName}.`)
        refresh()
      } else if (e.t === 'refresh') {
        refresh()
      }
    }
    let wasOpen = false
    socket.current = connectSocket(onEvent, (open) => {
      setConnected(open)
      if (open && wasOpen) { // reconectou: ressincroniza
        refresh()
        resyncRef.current()
        if (channelRef.current) loadMessages(channelRef.current)
      }
      if (open) wasOpen = true
    })
    return () => socket.current?.close()
  }, [refresh, loadMessages])

  // limpa indicadores de "digitando" vencidos
  useEffect(() => {
    const id = window.setInterval(() => {
      setTyping((t) => {
        const now = Date.now()
        let changed = false
        const next: typeof t = {}
        for (const [ch, users] of Object.entries(t)) {
          const keep = Object.fromEntries(Object.entries(users).filter(([, exp]) => exp > now))
          if (Object.keys(keep).length !== Object.keys(users).length) changed = true
          next[Number(ch)] = keep
        }
        return changed ? next : t
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // fecha menus
  useEffect(() => {
    const close = () => { setMenu(null); setSettingsOpen(false); setServerMenu(false); setMemberMenu(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); setDialog(null) } }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // escolhe um canal de texto ao trocar de servidor
  useEffect(() => {
    if (!server) { if (channelId !== null) setChannelId(null); return }
    if (channelId && server.categories.some((c) => c.channels.some((x) => x.id === channelId))) return
    const first = server.categories.flatMap((c) => c.channels).find((c) => c.kind === 'text')
    setChannelId(first?.id ?? null)
  }, [server, channelId])

  // carrega mensagens do canal ativo
  useEffect(() => {
    if (!channelId) return
    setUnread((u) => { const n = new Set(u); n.delete(channelId); return n })
    if (!msgs[channelId]) loadMessages(channelId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, loadMessages])

  // só mostra mensagens de um canal que você ainda enxerga (quem foi removido não vê o cache antigo)
  const current = channel && channelId ? msgs[channelId] ?? [] : []
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [current.length, channelId])

  useEffect(() => {
    if (voice.channelId !== null && data && !voiceChannel) {
      voice.leave()
      setView('text')
      // não cobre um aviso mais importante que já esteja na tela (ex.: "você foi removido")
      setNotice((n) => n || 'Você saiu da sala: ela não está mais disponível.')
      window.setTimeout(() => setNotice(''), 5000)
    }
  }, [data, voice, voiceChannel, flash])

  function send() {
    const text = draft.trim()
    if (!text || !channelId) return
    socket.current?.send({ t: 'message', channelId, text })
    setDraft('')
  }

  function onType(value: string) {
    setDraft(value)
    if (value && channelId) socket.current?.send({ t: 'typing', channelId })
  }

  async function logout() {
    try { await api.logout() } catch { /* já expirou */ }
    onLogout()
  }

  async function submitDialog(value: string) {
    if (!dialog) return
    try {
      if (dialog.kind === 'create-server') {
        const { id } = await api.createServer(value)
        await refresh()
        setServerId(id)
        setChannelId(null)
      } else if (dialog.kind === 'join-server') {
        const { id } = await api.joinServer(value)
        await refresh()
        setServerId(id)
        setChannelId(null)
      } else if (dialog.kind === 'create-channel' && server) {
        await api.createChannel(server.id, value, dialog.voice ? 'voice' : 'text')
        await refresh()
      } else if (dialog.kind === 'edit-channel') {
        await api.renameChannel(dialog.channel.id, value)
        await refresh()
      } else if (dialog.kind === 'edit-server') {
        await api.renameServer(dialog.id, value)
        await refresh()
      }
      setDialog(null)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Erro inesperado')
    }
  }

  async function deleteFromDialog() {
    if (!dialog) return
    try {
      if (dialog.kind === 'edit-channel') {
        await api.deleteChannel(dialog.channel.id)
        await refresh()
        flash('Canal excluído.')
      } else if (dialog.kind === 'remove-member') {
        await api.removeMember(dialog.serverId, dialog.member.id)
        await refresh()
        flash(`${dialog.member.name} foi removido do servidor.`)
      } else if (dialog.kind === 'leave-server') {
        await api.removeMember(dialog.id, 'me')
        setChannelId(null)
        await refresh()
      } else if (dialog.kind === 'edit-server') {
        await api.deleteServer(dialog.id)
        setChannelId(null)
        await refresh()
        flash('Servidor excluído.')
      }
      setDialog(null)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Erro inesperado')
    }
  }

  if (!data) return <div className="loading">Carregando…</div>

  const typers = channelId
    ? Object.keys(typing[channelId] ?? {}).map((id) => memberById(Number(id))?.name).filter(Boolean) as string[]
    : []
  const roles = server ? [...new Set(server.members.map((m) => (m.status === 'online' ? 'Online' : 'Offline')))].sort().reverse() : []

  return (
    <div className="app">
      <nav className="server-rail" aria-label="Servidores">
        <button className="rail-home" title="Mensagens diretas (em breve)" onClick={() => flash('Mensagens diretas chegam numa próxima etapa')}>
          <img src="/bubble.png" alt="Papo" width={30} />
        </button>
        <div className="rail-sep" />
        {data.servers.map((s) => (
          <div key={s.id} className={`rail-item ${s.id === serverId ? 'active' : ''}`}>
            <span className="pill" />
            <button
              className="server-icon"
              style={{ '--c': s.color } as React.CSSProperties}
              title={s.name}
              onClick={() => { setServerId(s.id); setChannelId(null) }}
            >
              {s.name.slice(0, 2).toUpperCase()}
            </button>
          </div>
        ))}
        <button className="server-icon add" title="Criar servidor" onClick={() => setDialog({ kind: 'create-server' })}><Plus size={22} /></button>
        <button className="server-icon add" title="Entrar com convite" onClick={() => setDialog({ kind: 'join-server' })}><Compass size={22} /></button>
      </nav>

      <aside className="channel-panel">
        <header className="panel-header">
          <button
            className="server-title"
            disabled={!server}
            title="Opções do servidor"
            onClick={(e) => { e.stopPropagation(); setServerMenu((o) => !o) }}
          >
            <strong>{server?.name ?? 'Sem servidor'}</strong>
            {server && <ChevronDown size={16} />}
          </button>
          {server?.isOwner && server.inviteCode && (
            <button className="icon-btn" title="Convidar pessoas" onClick={() => setDialog({ kind: 'invite', code: server.inviteCode! })}>
              <UserPlus size={18} />
            </button>
          )}
          {serverMenu && server && !server.isOwner && (
            <ul className="context-menu server-menu" onClick={(e) => e.stopPropagation()}>
              <li className="danger" onClick={() => { setServerMenu(false); setDialog({ kind: 'leave-server', id: server.id, name: server.name }) }}>Sair do servidor <LogOut size={14} /></li>
            </ul>
          )}
          {serverMenu && server?.isOwner && (
            <ul className="context-menu server-menu" onClick={(e) => e.stopPropagation()}>
              <li onClick={() => { setServerMenu(false); setDialog({ kind: 'invite', code: server.inviteCode! }) }}>Convidar pessoas <UserPlus size={14} /></li>
              <li onClick={() => { setServerMenu(false); setDialog({ kind: 'create-channel', voice: false }) }}>Criar canal de texto <Plus size={14} /></li>
              <li onClick={() => { setServerMenu(false); setDialog({ kind: 'create-channel', voice: true }) }}>Criar sala de voz <Plus size={14} /></li>
              <li className="sep" />
              <li onClick={() => { setServerMenu(false); setDialog({ kind: 'edit-server', id: server.id, name: server.name }) }}>Editar servidor <Pencil size={14} /></li>
              <li className="danger" onClick={() => { setServerMenu(false); setDialog({ kind: 'edit-server', id: server.id, name: server.name, askDelete: true }) }}>Excluir servidor <Trash2 size={14} /></li>
            </ul>
          )}
        </header>

        <div className="channel-scroll">
          {server?.categories.map((cat) => (
            <section key={cat.name}>
              <div className="category-row">
                <button className="category" onClick={() => setCollapsed((c) => ({ ...c, [cat.name]: !c[cat.name] }))}>
                  {collapsed[cat.name] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  {cat.name}
                </button>
                {server.isOwner && (
                  <button className="icon-btn small" title="Criar canal"
                    onClick={() => setDialog({ kind: 'create-channel', voice: cat.channels[0]?.kind === 'voice' })}>
                    <Plus size={16} />
                  </button>
                )}
              </div>
              {!collapsed[cat.name] && cat.channels.map((ch) => {
                const isUnread = unread.has(ch.id)
                const inRoom = ch.kind === 'voice' ? server.voice[ch.id] ?? [] : []
                return (
                  <div key={ch.id} className="channel-wrap">
                  <div className="channel-row">
                  <button
                    className={`channel ${ch.id === channelId ? 'selected' : ''} ${isUnread ? 'unread' : ''}`}
                    onClick={() => { if (ch.kind === 'text') { setChannelId(ch.id); setView('text') } else openVoice(ch) }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMenu({ x: e.clientX, y: e.clientY, channel: ch })
                    }}
                    title={ch.name}
                  >
                    {isUnread && <span className="pill" />}
                    {ch.kind === 'text' ? <Hash size={18} /> : <Volume2 size={18} />}
                    <span className="channel-name">{ch.name}</span>
                  </button>
                  {server.isOwner && (
                    <button className="channel-gear" title="Editar canal" onClick={(e) => { e.stopPropagation(); setDialog({ kind: 'edit-channel', channel: ch }) }}>
                      <Settings size={14} />
                    </button>
                  )}
                  </div>
                  {inRoom.map((uid) => {
                    const m = memberById(uid)
                    const speaking = voice.channelId === ch.id && !!voice.room?.getParticipantByIdentity(String(uid))?.isSpeaking
                    return (
                      <div
                        key={uid}
                        className={`voice-member ${speaking ? 'speaking' : ''} ${uid !== data.me.id && voice.channelId === ch.id ? 'adjustable' : ''}`}
                        onClick={(e) => { if (uid !== data.me.id && voice.channelId === ch.id) setVolMenu({ identity: String(uid), src: 'mic', name: m?.name ?? 'Alguém', x: e.clientX, y: e.clientY }) }}
                        onContextMenu={(e) => { if (uid !== data.me.id && voice.channelId === ch.id) { e.preventDefault(); setVolMenu({ identity: String(uid), src: 'mic', name: m?.name ?? 'Alguém', x: e.clientX, y: e.clientY }) } }}
                      >
                        <Avatar name={m?.name ?? '?'} color={m?.color ?? '#949ba4'} size={20} />
                        <span>{m?.name ?? 'Alguém'}</span>
                      </div>
                    )
                  })}
                  </div>
                )
              })}
            </section>
          ))}
        </div>

        {voice.channelId !== null && (
          <div className="voice-dock">
            <div className="voice-dock-top">
              <button className="voice-dock-info" onClick={() => setView('voice')} title="Abrir a sala">
                <strong>{voice.status === 'connecting' ? 'Conectando…' : 'Voz conectada'}</strong>
                <small>{voiceChannel?.name}</small>
              </button>
              <button className="icon-btn" title="Sair da sala" onClick={() => { voice.leave(); setView('text') }}><PhoneOff size={18} /></button>
            </div>
            <div className="voice-dock-actions">
              <button
                className={`dock-btn ${voice.camOn ? 'on' : ''}`}
                disabled={voice.status !== 'connected'}
                title={voice.camOn ? 'Desligar câmera' : 'Ligar câmera'}
                onClick={voice.toggleCamera}
              >{voice.camOn ? <Video size={18} /> : <VideoOff size={18} />}</button>
              <button
                className={`dock-btn ${voice.sharing ? 'on' : ''}`}
                disabled={voice.status !== 'connected'}
                title={voice.sharing ? 'Parar de compartilhar' : 'Compartilhar tela'}
                onClick={voice.toggleScreen}
              >{voice.sharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}</button>
            </div>
          </div>
        )}

        <footer className="user-panel">
          <div className="user-info">
            <span className="avatar-wrap">
              <Avatar name={data.me.name} color={data.me.color} size={32} />
              <span className={`status-dot ${connected ? 'status-online' : 'status-offline'}`} />
            </span>
            <div className="user-text"><strong>{data.me.name}</strong><small>{connected ? 'Conectado' : 'Reconectando…'}</small></div>
          </div>
          <button
            className={`icon-btn ${voice.status === 'connected' && !voice.micOn ? 'danger' : ''}`}
            title={voice.status === 'connected' ? (voice.micOn ? 'Silenciar microfone' : 'Ligar microfone') : 'Entre numa sala de voz para usar o microfone'}
            onClick={() => voice.status === 'connected' ? voice.toggleMic() : flash('Entre numa sala de voz para usar o microfone.')}
          >{voice.status === 'connected' && !voice.micOn ? <MicOff size={18} /> : <Mic size={18} />}</button>
          <button
            className={`icon-btn ${voice.deafened ? 'danger' : ''}`}
            title={voice.deafened ? 'Voltar a ouvir' : 'Ensurdecer'}
            onClick={() => voice.status === 'connected' ? voice.toggleDeafen() : flash('Entre numa sala de voz primeiro.')}
          >{voice.deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}</button>
          <div className="settings-wrap">
            <button className="icon-btn" title="Aparência e conta" onClick={(e) => { e.stopPropagation(); setSettingsOpen((o) => !o) }}>
              <Settings size={18} />
            </button>
            {settingsOpen && (
              <div className="popover" onClick={(e) => e.stopPropagation()}>
                <label>Tema
                  <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                    <option value="dark">Escuro</option><option value="darker">Mais escuro</option>
                    <option value="midnight">Meia-noite</option><option value="light">Claro</option>
                  </select>
                </label>
                <label>Densidade
                  <select value={density} onChange={(e) => setDensity(e.target.value as Density)}>
                    <option value="default">Padrão</option><option value="cozy">Confortável</option>
                    <option value="compact">Compacta</option>
                  </select>
                </label>
                <button className="menu-btn plain" onClick={() => { setSettingsOpen(false); setAudioOpen(true) }}><Mic size={16} /> Áudio e microfone</button>
                <button className="menu-btn" onClick={logout}><LogOut size={16} /> Sair</button>
              </div>
            )}
          </div>
        </footer>
      </aside>

      <main className="chat">
        <header className="chat-header">
          {inVoiceView ? <Volume2 size={22} className="muted" /> : <Hash size={22} className="muted" />}
          <strong>{inVoiceView ? voiceChannel?.name : channel?.name ?? 'sem canal'}</strong>
          <span className="spacer" />
          <button className="icon-btn" title="Silenciar"><BellOff size={20} /></button>
          <button className="icon-btn" title="Fixadas"><Pin size={20} /></button>
          <button className={`icon-btn ${showMembers ? 'on' : ''}`} title="Membros" onClick={() => setShowMembers((s) => !s)}>
            <Users size={20} />
          </button>
          <label className="search"><input placeholder={`Buscar ${server?.name ?? ''}`} /><Search size={16} /></label>
        </header>

        <div className="chat-body">
          <div className="chat-main">
            {inVoiceView ? (
              <VoiceRoom voice={voice} channelName={voiceChannel?.name ?? ''} memberById={memberById} onVolumeMenu={setVolMenu} />
            ) : (<>
            <div className="messages" ref={listRef}>
              {channel && current.length === 0 && (
                <div className="empty">Este é o começo de <strong>#{channel.name}</strong>. Mande a primeira mensagem!</div>
              )}
              {current.map((msg, i) => {
                const prev = current[i - 1]
                const grouped = !!prev && prev.authorId === msg.authorId && msg.createdAt - prev.createdAt < 5 * 60_000
                const a = memberById(msg.authorId)
                const name = a?.name ?? 'Ex-membro'
                const color = a?.color ?? '#949ba4'
                return (
                  <article key={msg.id} className={`message ${grouped ? 'grouped' : ''}`}>
                    {!grouped ? <Avatar name={name} color={color} /> : <span className="gutter" />}
                    <div className="message-body">
                      {!grouped && (
                        <div className="message-head">
                          <strong style={{ color }}>{name}</strong>
                          <time>{formatTime(msg.createdAt)}</time>
                        </div>
                      )}
                      <p>{msg.text}</p>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="typing">{typers.length > 0 && `${typers.join(', ')} ${typers.length > 1 ? 'estão' : 'está'} digitando…`}</div>
            <form className="composer" onSubmit={(e) => { e.preventDefault(); send() }}>
              <button type="button" className="icon-btn" title="Anexar (em breve)"><PlusCircle size={22} /></button>
              <input
                value={draft}
                onChange={(e) => onType(e.target.value)}
                placeholder={channel ? `Conversar em #${channel.name}` : 'Selecione um canal'}
                disabled={!channel}
                maxLength={2000}
              />
              <button type="button" className="icon-btn" title="Emoji"><Smile size={22} /></button>
            </form>
            </>)}
          </div>

          {showMembers && server && (
            <aside className="member-panel">
              {roles.map((group) => {
                const list = server.members.filter((m) => (m.status === 'online' ? 'Online' : 'Offline') === group)
                return (
                  <section key={group}>
                    <h3>{group} — {list.length}</h3>
                    {list.map((m) => (
                      <div
                        key={m.id}
                        className={`member ${m.status}`}
                        onContextMenu={(e) => {
                          if (!server.isOwner || m.id === data.me.id || m.role === 'owner') return
                          e.preventDefault()
                          e.stopPropagation()
                          setMemberMenu({ x: e.clientX, y: e.clientY, member: m })
                        }}
                      >
                        <span className="avatar-wrap">
                          <Avatar name={m.name} color={m.color} size={32} />
                          <span className={`status-dot status-${m.status}`} />
                        </span>
                        <div className="member-text">
                          <span style={{ color: m.color }}>{m.name}</span>
                          {m.role === 'owner' && <small>Dono do servidor</small>}
                        </div>
                        {server.isOwner && m.id !== data.me.id && m.role !== 'owner' && (
                          <button className="member-kick" title="Remover do servidor" onClick={() => setDialog({ kind: 'remove-member', serverId: server.id, member: m })}>
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                )
              })}
            </aside>
          )}
        </div>
      </main>

      {menu && (
        <ul className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <li className="disabled">Marcar como lida</li>
          <li className="sep" />
          {server?.isOwner && (<>
            <li onClick={() => { setDialog({ kind: 'edit-channel', channel: menu.channel }); setMenu(null) }}>Editar canal <Pencil size={14} /></li>
            <li className="danger" onClick={() => { setDialog({ kind: 'edit-channel', channel: menu.channel, askDelete: true }); setMenu(null) }}>Excluir canal <Trash2 size={14} /></li>
            <li className="sep" />
          </>)}
          <li onClick={() => { navigator.clipboard?.writeText(`#${menu.channel.name}`); setMenu(null); flash("Nome do canal copiado") }}>Copiar nome do canal</li>
          <li className="has-sub disabled">Silenciar canal <ChevronRight size={14} /></li>
        </ul>
      )}

      {memberMenu && (
        <ul className="context-menu" style={{ left: memberMenu.x, top: memberMenu.y }} onClick={(e) => e.stopPropagation()}>
          <li className="danger" onClick={() => { setDialog({ kind: 'remove-member', serverId: server!.id, member: memberMenu.member }); setMemberMenu(null) }}>Remover do servidor <UserMinus size={14} /></li>
        </ul>
      )}
      {volMenu && (
        <VolumeMenu
          target={volMenu}
          setting={voice.volumes[`${volMenu.identity}:${volMenu.src}`] ?? { vol: 1, muted: false }}
          onChange={(patch) => voice.setVolume(volMenu.identity, volMenu.src, patch)}
          onClose={() => setVolMenu(null)}
        />
      )}
      {audioOpen && <AudioSettings onClose={() => setAudioOpen(false)} />}
      {dialog && <DialogBox dialog={dialog} onSubmit={submitDialog} onDelete={deleteFromDialog} onClose={() => setDialog(null)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

function DialogBox({ dialog, onSubmit, onDelete, onClose }: {
  dialog: Dialog; onSubmit: (v: string) => void; onDelete: () => void; onClose: () => void
}) {
  const initial = dialog.kind === 'edit-channel' ? dialog.channel.name : dialog.kind === 'edit-server' ? dialog.name : ''
  const [value, setValue] = useState(initial)
  const [confirming, setConfirming] = useState(
    (dialog.kind === 'edit-channel' || dialog.kind === 'edit-server') && !!dialog.askDelete,
  )
  const [typed, setTyped] = useState('')

  if (dialog.kind === 'invite') {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <h2>Convidar amigos</h2>
          <p className="muted">Mande este código. Quem recebe usa em "Registrar" (conta nova) ou em "Entrar com convite" (já tem conta).</p>
          <div className="code-box">
            <code>{dialog.code}</code>
            <button className="icon-btn" title="Copiar" onClick={() => navigator.clipboard?.writeText(dialog.code)}><Copy size={18} /></button>
          </div>
          <div className="dialog-actions"><button className="primary" onClick={onClose}>Fechar</button></div>
        </div>
      </div>
    )
  }

  if (dialog.kind === 'remove-member' || dialog.kind === 'leave-server') {
    const leave = dialog.kind === 'leave-server'
    return (
      <div className="overlay" onClick={onClose}>
        <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onDelete() }}>
          <h2>{leave ? 'Sair do servidor' : 'Remover membro'}</h2>
          <p className="muted">
            {leave
              ? <>Você vai sair de <strong>{dialog.name}</strong>. Para voltar, vai precisar do código de convite.</>
              : <><strong>{dialog.member.name}</strong> será removido do servidor e perderá o acesso aos canais e salas de voz. Se tiver o código de convite, poderá entrar de novo.</>}
          </p>
          <div className="dialog-actions">
            <button type="button" className="link" onClick={onClose}>Cancelar</button>
            <button className="danger-btn">{leave ? 'Sair do servidor' : 'Remover'}</button>
          </div>
        </form>
      </div>
    )
  }

  if (dialog.kind === 'edit-channel' || dialog.kind === 'edit-server') {
    const isServer = dialog.kind === 'edit-server'
    const targetName = dialog.kind === 'edit-server' ? dialog.name : dialog.channel.name
    const isVoice = dialog.kind === 'edit-channel' && dialog.channel.kind === 'voice'
    const noun = isServer ? 'servidor' : isVoice ? 'sala de voz' : 'canal'

    if (confirming) {
      const needsName = isServer
      const ok = !needsName || typed.trim() === targetName
      return (
        <div className="overlay" onClick={onClose}>
          <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ok) onDelete() }}>
            <h2>Excluir {noun}</h2>
            <p className="muted">
              {isServer
                ? <>Isto apaga <strong>{targetName}</strong> para todos: canais, mensagens e membros. Não dá para desfazer.</>
                : isVoice
                  ? <>A sala <strong>{targetName}</strong> será apagada e quem estiver nela será desconectado. Não dá para desfazer.</>
                  : <>O canal <strong>#{targetName}</strong> e todas as suas mensagens serão apagados para todos. Não dá para desfazer.</>}
            </p>
            {needsName && (
              <label>Digite o nome do servidor para confirmar
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={targetName} autoFocus />
              </label>
            )}
            <div className="dialog-actions">
              <button type="button" className="link" onClick={() => (dialog.askDelete ? onClose() : setConfirming(false))}>Cancelar</button>
              <button className="danger-btn" disabled={!ok}>Excluir {noun}</button>
            </div>
          </form>
        </div>
      )
    }

    return (
      <div className="overlay" onClick={onClose}>
        <form className="dialog" onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()) }}>
          <h2>Editar {noun}</h2>
          <label>Nome<input value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={40} /></label>
          <div className="dialog-actions split">
            <button type="button" className="danger-link" onClick={() => setConfirming(true)}><Trash2 size={16} /> Excluir</button>
            <span className="spacer" />
            <button type="button" className="link" onClick={onClose}>Cancelar</button>
            <button className="primary" disabled={!value.trim() || value.trim() === targetName}>Salvar</button>
          </div>
        </form>
      </div>
    )
  }

  const cfg = {
    'create-server': { title: 'Criar servidor', label: 'Nome do servidor', cta: 'Criar' },
    'join-server': { title: 'Entrar com convite', label: 'Código de convite', cta: 'Entrar' },
    'create-channel': { title: dialog.kind === 'create-channel' && dialog.voice ? 'Criar sala de voz' : 'Criar canal de texto', label: 'Nome', cta: 'Criar' },
  }[dialog.kind]
  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()) }}>
        <h2>{cfg.title}</h2>
        <label>{cfg.label}<input value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={40} /></label>
        <div className="dialog-actions">
          <button type="button" className="link" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={!value.trim()}>{cfg.cta}</button>
        </div>
      </form>
    </div>
  )
}
