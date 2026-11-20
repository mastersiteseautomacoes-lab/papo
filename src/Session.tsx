import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Copy, Link2, LogOut } from 'lucide-react'
import { api, getToken, type SessionInfo } from './api'
import { useVoice } from './voice'
import VoiceRoom from './VoiceRoom'
import VolumeMenu, { type VolumeTarget } from './VolumeMenu'

const NAME_KEY = 'papo.guestName'
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }
const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n) } catch { /* sem storage */ } }

/** Tira traços e espaços e põe em minúsculas: "ABCD-efgh-jkmn" -> "abcdefghjkmn" */
export const normalizeCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** "abcdefghjkmn" -> "abcd-efgh-jkmn" */
export const prettyCode = (code: string) => normalizeCode(code).replace(/(.{4})(?=.)/g, '$1-')

/** Extrai o código de um texto colado: o código solto (com ou sem traços) ou um link terminado em /j/<código>. */
export function extractCode(text: string): string | null {
  const t = text.trim()
  const fromLink = t.match(/\/j\/([a-z0-9-]+)/i)?.[1]
  const code = (fromLink ?? t).toLowerCase().replace(/[^a-z0-9]/g, '')
  return code.length === 12 ? code : null
}

/** Copia para a área de transferência (a API moderna só existe em páginas seguras). */
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { /* tenta o método antigo */ }
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { /* sem permissão */ }
  el.remove()
  return ok
}

/** Página de uma sessão por link (/j/<código>): pede o nome (se não tem conta), entra e mostra a sala. */
export function SessionPage({ code: rawCode }: { code: string }) {
  const code = normalizeCode(rawCode) // o link pode vir com traços ou em maiúsculas
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState(readName)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)
  const [volMenu, setVolMenu] = useState<VolumeTarget | null>(null)
  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(''), 6000) }, [])
  const voice = useVoice({ onError: flash, micOnJoin: false })

  useEffect(() => {
    let alive = true
    api.sessionInfo(code)
      .then((i) => { if (alive) setInfo(i) })
      .catch((e: Error) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [code])

  const link = `${location.origin}/j/${code}`
  const inRoom = voice.status !== 'idle'
  const myName = info?.me?.name ?? name.trim()

  // Ao sair (ou ser desconectado), consulta de novo: mostra a contagem atual, ou "encerrada" se o criador a encerrou.
  const wasInRoom = useRef(false)
  useEffect(() => {
    if (inRoom) { wasInRoom.current = true; return }
    if (!wasInRoom.current) return
    wasInRoom.current = false
    api.sessionInfo(code).then(setInfo).catch((e: Error) => { setInfo(null); setError(e.message) })
  }, [inRoom, code])

  async function enter(e: FormEvent) {
    e.preventDefault()
    if (!myName) return
    if (!info?.me) saveName(myName)
    await voice.joinSession(code, myName)
  }

  async function copyLink() {
    if (await copyText(link)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    else flash(`Não consegui copiar. O link é ${link}`)
  }

  async function end() {
    if (!confirm('Encerrar a sessão para todos? O link deixa de funcionar.')) return
    try {
      await api.endSession(code)
      voice.leave()
      setInfo(null)
      setError('Sessão encerrada.')
    } catch (e) { flash(e instanceof Error ? e.message : 'Não consegui encerrar a sessão.') }
  }

  if (error) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <img src="/logo.png" alt="" width={72} height={72} className="auth-logo" />
          <h1>{error}</h1>
          <p className="muted">Confira o código ou peça um link novo a quem criou a sessão.</p>
          <a className="primary session-link-btn" href="/s">Entrar com outro código</a>
        </div>
      </div>
    )
  }
  if (!info) return <div className="auth-screen"><div className="muted">Procurando a sessão…</div></div>

  if (!inRoom) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={enter}>
          <img src="/logo.png" alt="" width={72} height={72} className="auth-logo" />
          <h1>Entrar na sessão</h1>
          <p className="muted">Código <span className="session-code">{prettyCode(code)}</span>
            {info.participants ? ` · ${info.participants} ${info.participants === 1 ? 'pessoa' : 'pessoas'} na sala` : ''}</p>
          {info.me ? (
            <p>Você entra como <strong>{info.me.name}</strong>.</p>
          ) : (
            <label>Seu nome
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Como quer aparecer" autoFocus required />
            </label>
          )}
          {toast && <div className="form-error" role="alert">{toast}</div>}
          <button className="primary" disabled={voice.status === 'connecting' || !myName}>
            {voice.status === 'connecting' ? 'Conectando…' : 'Entrar'}
          </button>
          <a className="link" href="/s">Usar outro código</a>
        </form>
      </div>
    )
  }

  const people = voice.room ? 1 + voice.room.remoteParticipants.size : info.participants ?? 1
  return (
    <div className="session-page" onClick={() => setVolMenu(null)}>
      <header className="session-bar">
        <Link2 size={18} className="muted" />
        <span className="session-code" title="Código da sessão">{prettyCode(code)}</span>
        <button className="session-btn" onClick={copyLink} title="Copiar o link da sessão">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar link'}
        </button>
        <span className="spacer" />
        <small className="muted">{people} {people === 1 ? 'pessoa' : 'pessoas'}</small>
        {info.isCreator && <button className="session-btn danger" onClick={end} title="Encerra a sessão para todos"><LogOut size={16} /> Encerrar</button>}
      </header>
      <VoiceRoom
        voice={voice}
        channelName="da sessão"
        memberById={() => undefined}
        onVolumeMenu={setVolMenu}
      />
      {volMenu && (
        <VolumeMenu
          target={volMenu}
          setting={voice.volumes[`${volMenu.identity}:${volMenu.src}`] ?? { vol: 1, muted: false }}
          onChange={(patch) => voice.setVolume(volMenu.identity, volMenu.src, patch)}
          onClose={() => setVolMenu(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/** Página /s: criar uma sessão (precisa de conta) ou entrar com um código ou link. */
export function SessionHub() {
  const authed = !!getToken()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function join(e: FormEvent) {
    e.preventDefault()
    const code = extractCode(text)
    if (!code) return setError('Código inválido: são 12 letras e números, como abcd-efgh-jkmn. Pode colar o link inteiro.')
    location.assign(`/j/${code}`)
  }

  async function create() {
    setBusy(true); setError('')
    try {
      const { code } = await api.createSession()
      location.assign(`/j/${code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui criar a sessão.')
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <a className="auth-back" href="/"><ArrowLeft size={18} /> Início</a>
        <img src="/logo.png" alt="" width={72} height={72} className="auth-logo" />
        <h1>Sessões por link</h1>
        <p className="muted">Compartilhe a tela com quem tem o link, sem precisar de conta.</p>
        <button className="primary" onClick={create} disabled={busy || !authed}>{busy ? 'Criando…' : 'Criar sessão'}</button>
        {!authed && <p className="muted">Para criar uma sessão, <a className="link" href="/">entre na sua conta</a>. Para entrar numa, não precisa.</p>}
        <form onSubmit={join} className="session-join">
          <label>Entrar com código ou link
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="abcd-efgh-jkmn" autoComplete="off" spellCheck={false} />
          </label>
          <button className="primary" disabled={!text.trim()}>Entrar</button>
        </form>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </div>
  )
}
