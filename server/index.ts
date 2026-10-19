import express from 'express'
import { createServer as createHttp } from 'node:http'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import httpProxy from 'http-proxy'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { db, createServer, pickColor } from './db.ts'
import {
  createSession, hashPassword, rateLimit, requireAuth, userFromToken, verifyPassword, type AuthedRequest,
} from './auth.ts'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '127.0.0.1'
const MAX_TEXT = 2000
// Voz e vídeo (LiveKit). Só ligam se as chaves vierem do ambiente.
const LK_KEY = process.env.LIVEKIT_API_KEY
const LK_SECRET = process.env.LIVEKIT_API_SECRET
const LK_TARGET = process.env.LIVEKIT_TARGET ?? 'http://127.0.0.1:7880'
const VOICE_ENABLED = !!(LK_KEY && LK_SECRET)

const app = express()
app.disable('x-powered-by')

// O navegador fala com o LiveKit por /lk (mesma porta e mesmo HTTPS do Papo).
const lkProxy = httpProxy.createProxyServer({ target: LK_TARGET, ws: true, changeOrigin: false })
lkProxy.on('error', (_err, _req, res) => {
  if ('writeHead' in res && !res.headersSent) { res.writeHead(502); res.end('LiveKit indisponível') }
  else if ('destroy' in res) res.destroy()
})
if (VOICE_ENABLED) app.use('/lk', (req, res) => lkProxy.web(req, res))

app.use(express.json({ limit: '32kb' }))

// Sem login, sem dados: só confirma que este servidor do Papo está no ar (a lista de amigos do app consulta isto).
app.get('/api/health', (_req, res) => res.json({ papo: true }))

// ---------- helpers ----------
const one = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as T | undefined
const all = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args) as T[]

const online = new Map<number, Set<WebSocket>>() // userId -> sockets
const isOnline = (id: number) => (online.get(id)?.size ?? 0) > 0

function serverMemberIds(serverId: number): number[] {
  return all<{ user_id: number }>('SELECT user_id FROM members WHERE server_id = ?', serverId).map((r) => r.user_id)
}

function sendTo(userIds: number[], payload: unknown) {
  const data = JSON.stringify(payload)
  for (const id of userIds) for (const ws of online.get(id) ?? []) if (ws.readyState === ws.OPEN) ws.send(data)
}

const serverOfChannel = (channelId: number) =>
  one<{ server_id: number }>('SELECT server_id FROM channels WHERE id = ?', channelId)?.server_id

const isMember = (serverId: number, userId: number) =>
  !!one('SELECT 1 FROM members WHERE server_id = ? AND user_id = ?', serverId, userId)

function messageDto(id: number) {
  const m = one<{ id: number; channel_id: number; user_id: number; text: string; created_at: number }>(
    'SELECT * FROM messages WHERE id = ?', id)!
  return { id: m.id, channelId: m.channel_id, authorId: m.user_id, text: m.text, createdAt: m.created_at }
}

function bootstrap(userId: number) {
  const me = one<{ id: number; username: string; color: string }>('SELECT id, username, color FROM users WHERE id = ?', userId)!
  const servers = all<{ id: number; name: string; color: string; owner_id: number; invite_code: string }>(
    `SELECT s.* FROM servers s JOIN members m ON m.server_id = s.id WHERE m.user_id = ? ORDER BY s.id`, userId,
  ).map((s) => {
    const channels = all<{ id: number; category: string; name: string; kind: string }>(
      'SELECT id, category, name, kind FROM channels WHERE server_id = ? ORDER BY position, id', s.id)
    const categories: { name: string; channels: unknown[] }[] = []
    for (const c of channels) {
      let cat = categories.find((x) => x.name === c.category)
      if (!cat) categories.push((cat = { name: c.category, channels: [] }))
      cat.channels.push({ id: c.id, name: c.name, kind: c.kind })
    }
    const members = all<{ id: number; username: string; color: string; role: string }>(
      `SELECT u.id, u.username, u.color, m.role FROM members m JOIN users u ON u.id = m.user_id
       WHERE m.server_id = ? ORDER BY u.username`, s.id,
    ).map((u) => ({ id: u.id, name: u.username, color: u.color, role: u.role, status: isOnline(u.id) ? 'online' : 'offline' }))
    const voice: Record<number, number[]> = {}
    for (const c of channels) if (c.kind === 'voice') voice[c.id] = voiceUsers(c.id)
    return {
      id: s.id, name: s.name, color: s.color, isOwner: s.owner_id === userId,
      inviteCode: s.owner_id === userId ? s.invite_code : undefined, categories, members, voice,
    }
  })
  return { me: { id: me.id, name: me.username, color: me.color }, servers, voiceEnabled: VOICE_ENABLED }
}

// ---------- presença em salas de voz ----------
const voiceByUser = new Map<number, { channelId: number; ws: WebSocket }>()

function voiceUsers(channelId: number): number[] {
  return [...voiceByUser.entries()].filter(([, v]) => v.channelId === channelId).map(([id]) => id)
}

function broadcastVoice(channelId: number) {
  const sid = serverOfChannel(channelId)
  if (sid) sendTo(serverMemberIds(sid), { t: 'voice', channelId, users: voiceUsers(channelId) })
}

function leaveVoice(userId: number, ws?: WebSocket) {
  const cur = voiceByUser.get(userId)
  if (!cur || (ws && cur.ws !== ws)) return
  voiceByUser.delete(userId)
  broadcastVoice(cur.channelId)
}

const refresh = (serverId: number) => sendTo(serverMemberIds(serverId), { t: 'refresh' })

// ---------- auth ----------
const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,24}$/u

app.post('/api/register', rateLimit(10, 60_000), (req, res) => {
  const { username, password, inviteCode } = req.body ?? {}
  if (typeof username !== 'string' || !USERNAME_RE.test(username))
    return res.status(400).json({ error: 'Nome de usuário: 2 a 24 letras, números, _ . -' })
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' })

  const first = one<{ n: number }>('SELECT COUNT(*) n FROM users')!.n === 0
  let server: { id: number } | undefined
  if (!first) {
    server = typeof inviteCode === 'string' ? one<{ id: number }>('SELECT id FROM servers WHERE invite_code = ?', inviteCode.trim()) : undefined
    if (!server) return res.status(403).json({ error: 'Código de convite inválido' })
  }
  if (one('SELECT 1 FROM users WHERE username = ?', username)) return res.status(409).json({ error: 'Esse nome já está em uso' })

  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, color, created_at) VALUES (?, ?, ?, ?)')
    .run(username, hashPassword(password), pickColor(Date.now() % 997), Date.now())
  const userId = Number(lastInsertRowid)
  if (first) createServer('Nosso Servidor', userId)
  else {
    db.prepare("INSERT INTO members (server_id, user_id, role) VALUES (?, ?, 'member')").run(server!.id, userId)
    refresh(server!.id)
  }
  res.json({ token: createSession(userId) })
})

app.post('/api/login', rateLimit(10, 60_000), (req, res) => {
  const { username, password } = req.body ?? {}
  const u = typeof username === 'string' ? one<{ id: number; password_hash: string }>('SELECT id, password_hash FROM users WHERE username = ?', username) : undefined
  if (!u || typeof password !== 'string' || !verifyPassword(password, u.password_hash))
    return res.status(401).json({ error: 'Usuário ou senha incorretos' })
  res.json({ token: createSession(u.id) })
})

app.post('/api/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run((req as AuthedRequest).token)
  res.json({ ok: true })
})

// ---------- dados ----------
app.get('/api/bootstrap', requireAuth, (req, res) => res.json(bootstrap((req as AuthedRequest).userId)))

app.get('/api/channels/:id/messages', requireAuth, (req, res) => {
  const channelId = Number(req.params.id)
  const sid = serverOfChannel(channelId)
  if (!sid || !isMember(sid, (req as AuthedRequest).userId)) return res.status(404).json({ error: 'Canal não encontrado' })
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER
  const rows = all<{ id: number }>(
    'SELECT id FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT 50', channelId, before)
  res.json(rows.reverse().map((r) => messageDto(r.id)))
})

app.post('/api/servers', requireAuth, (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 40)
  if (!name) return res.status(400).json({ error: 'Dê um nome ao servidor' })
  const id = createServer(name, (req as AuthedRequest).userId)
  res.json({ id })
})

app.post('/api/servers/join', requireAuth, (req, res) => {
  const s = one<{ id: number }>('SELECT id FROM servers WHERE invite_code = ?', String(req.body?.code ?? '').trim())
  if (!s) return res.status(404).json({ error: 'Convite inválido' })
  db.prepare("INSERT OR IGNORE INTO members (server_id, user_id, role) VALUES (?, ?, 'member')").run(s.id, (req as AuthedRequest).userId)
  refresh(s.id)
  res.json({ id: s.id })
})

app.post('/api/servers/:id/channels', requireAuth, (req, res) => {
  const serverId = Number(req.params.id)
  const s = one<{ owner_id: number }>('SELECT owner_id FROM servers WHERE id = ?', serverId)
  if (!s || s.owner_id !== (req as AuthedRequest).userId) return res.status(403).json({ error: 'Só o dono pode criar canais' })
  const name = String(req.body?.name ?? '').trim().slice(0, 40)
  const kind = req.body?.kind === 'voice' ? 'voice' : 'text'
  if (!name) return res.status(400).json({ error: 'Dê um nome ao canal' })
  const category = kind === 'voice' ? 'Canais de voz' : 'Canais de texto'
  const pos = one<{ p: number }>('SELECT COALESCE(MAX(position), 0) + 1 p FROM channels WHERE server_id = ?', serverId)!.p
  const { lastInsertRowid } = db
    .prepare('INSERT INTO channels (server_id, category, name, kind, position) VALUES (?, ?, ?, ?, ?)')
    .run(serverId, category, name, kind, pos)
  refresh(serverId)
  res.json({ id: Number(lastInsertRowid) })
})

const isOwner = (serverId: number, userId: number) =>
  one<{ owner_id: number }>('SELECT owner_id FROM servers WHERE id = ?', serverId)?.owner_id === userId
const cleanName = (v: unknown) => String(v ?? '').trim().slice(0, 40)

/** Fecha a sala do LiveKit de um canal (expulsa quem estiver nela). */
function closeVoiceRoom(channelId: number) {
  for (const uid of voiceUsers(channelId)) voiceByUser.delete(uid)
  if (!VOICE_ENABLED) return
  new RoomServiceClient(LK_TARGET, LK_KEY!, LK_SECRET!).deleteRoom(`ch-${channelId}`).catch(() => { /* sala vazia ou LiveKit fora */ })
}

app.patch('/api/servers/:id', requireAuth, (req, res) => {
  const serverId = Number(req.params.id)
  if (!isOwner(serverId, (req as AuthedRequest).userId)) return res.status(403).json({ error: 'Só o dono pode editar o servidor' })
  const name = cleanName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'Dê um nome ao servidor' })
  db.prepare('UPDATE servers SET name = ? WHERE id = ?').run(name, serverId)
  refresh(serverId)
  res.json({ ok: true })
})

app.delete('/api/servers/:id', requireAuth, (req, res) => {
  const serverId = Number(req.params.id)
  if (!isOwner(serverId, (req as AuthedRequest).userId)) return res.status(403).json({ error: 'Só o dono pode excluir o servidor' })
  const members = serverMemberIds(serverId)
  for (const c of all<{ id: number }>("SELECT id FROM channels WHERE server_id = ? AND kind = 'voice'", serverId)) closeVoiceRoom(c.id)
  db.prepare('DELETE FROM servers WHERE id = ?').run(serverId) // apaga canais, mensagens e membros em cascata
  sendTo(members, { t: 'refresh' })
  res.json({ ok: true })
})

// Remover um membro (só o dono) ou sair do servidor (você mesmo). O dono não sai: precisa excluir o servidor.
app.delete('/api/servers/:id/members/:uid', requireAuth, (req, res) => {
  const serverId = Number(req.params.id)
  const me = (req as AuthedRequest).userId
  const target = req.params.uid === 'me' ? me : Number(req.params.uid)
  const server = one<{ name: string; owner_id: number }>('SELECT name, owner_id FROM servers WHERE id = ?', serverId)
  if (!server || !isMember(serverId, me)) return res.status(404).json({ error: 'Servidor não encontrado' })
  if (target !== me && server.owner_id !== me) return res.status(403).json({ error: 'Só o dono pode remover membros' })
  if (target === server.owner_id) return res.status(400).json({ error: 'O dono não pode sair nem ser removido. Para encerrar, exclua o servidor.' })
  if (!isMember(serverId, target)) return res.status(404).json({ error: 'Essa pessoa não está no servidor' })

  const before = serverMemberIds(serverId)
  // tira da sala de voz deste servidor, se estiver em uma
  const v = voiceByUser.get(target)
  if (v && serverOfChannel(v.channelId) === serverId) {
    voiceByUser.delete(target)
    broadcastVoice(v.channelId)
    if (VOICE_ENABLED) {
      new RoomServiceClient(LK_TARGET, LK_KEY!, LK_SECRET!).removeParticipant(`ch-${v.channelId}`, String(target)).catch(() => { /* já saiu */ })
    }
  }
  db.prepare('DELETE FROM members WHERE server_id = ? AND user_id = ?').run(serverId, target)
  sendTo([target], { t: 'removed', serverName: server.name, kicked: target !== me })
  sendTo(before, { t: 'refresh' })
  res.json({ ok: true })
})

app.patch('/api/channels/:id', requireAuth, (req, res) => {
  const channelId = Number(req.params.id)
  const sid = serverOfChannel(channelId)
  if (!sid || !isOwner(sid, (req as AuthedRequest).userId)) return res.status(403).json({ error: 'Só o dono pode editar canais' })
  const name = cleanName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'Dê um nome ao canal' })
  db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, channelId)
  refresh(sid)
  res.json({ ok: true })
})

app.delete('/api/channels/:id', requireAuth, (req, res) => {
  const channelId = Number(req.params.id)
  const sid = serverOfChannel(channelId)
  if (!sid || !isOwner(sid, (req as AuthedRequest).userId)) return res.status(403).json({ error: 'Só o dono pode excluir canais' })
  closeVoiceRoom(channelId)
  db.prepare('DELETE FROM channels WHERE id = ?').run(channelId)
  refresh(sid)
  res.json({ ok: true })
})

app.post('/api/voice/token', requireAuth, async (req, res) => {
  if (!VOICE_ENABLED) return res.status(503).json({ error: 'Voz e vídeo não estão ativos neste servidor' })
  const userId = (req as AuthedRequest).userId
  const channelId = Number(req.body?.channelId)
  const ch = one<{ server_id: number; kind: string }>('SELECT server_id, kind FROM channels WHERE id = ?', channelId)
  if (!ch || ch.kind !== 'voice' || !isMember(ch.server_id, userId)) return res.status(404).json({ error: 'Sala não encontrada' })
  const user = one<{ username: string }>('SELECT username FROM users WHERE id = ?', userId)!
  const at = new AccessToken(LK_KEY!, LK_SECRET!, { identity: String(userId), name: user.username, ttl: '6h' })
  at.addGrant({ room: `ch-${channelId}`, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false })
  res.json({ token: await at.toJwt() })
})

// ---------- frontend (build) ----------
const dist = resolve(process.env.DIST_DIR ?? 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api|ws|lk).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')))
}

// ---------- WebSocket ----------
const http = createHttp(app)
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 })

http.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  } else if (VOICE_ENABLED && pathname.startsWith('/lk/')) {
    req.url = req.url!.slice(3) // tira o prefixo /lk
    lkProxy.ws(req, socket, head)
  } else {
    socket.destroy()
  }
})

const lastTyping = new Map<string, number>()

wss.on('connection', (ws, req) => {
  const token = new URL(req.url ?? '', 'http://x').searchParams.get('token') ?? undefined
  const userId = userFromToken(token)
  if (!userId) return ws.close(4401, 'unauthorized')

  const wasOnline = isOnline(userId)
  if (!online.has(userId)) online.set(userId, new Set())
  online.get(userId)!.add(ws)
  const peers = () => all<{ user_id: number }>(
    'SELECT DISTINCT m2.user_id FROM members m1 JOIN members m2 ON m1.server_id = m2.server_id WHERE m1.user_id = ?', userId,
  ).map((r) => r.user_id)
  if (!wasOnline) sendTo(peers(), { t: 'presence', userId, status: 'online' })

  const times: number[] = []
  ws.on('message', (raw) => {
    let msg: { t?: string; channelId?: number; text?: string }
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (msg.t === 'voice-leave') return leaveVoice(userId, ws)
    const channelId = Number(msg.channelId)
    const sid = serverOfChannel(channelId)
    if (!sid || !isMember(sid, userId)) return

    if (msg.t === 'voice-join') {
      const kind = one<{ kind: string }>('SELECT kind FROM channels WHERE id = ?', channelId)?.kind
      if (!VOICE_ENABLED || kind !== 'voice') return
      const prev = voiceByUser.get(userId)
      voiceByUser.set(userId, { channelId, ws })
      if (prev && prev.channelId !== channelId) broadcastVoice(prev.channelId)
      broadcastVoice(channelId)
    } else if (msg.t === 'message') {
      const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_TEXT) : ''
      if (!text) return
      const now = Date.now()
      while (times.length && times[0] < now - 5000) times.shift()
      if (times.length >= 8) return // máx. 8 mensagens a cada 5 s
      times.push(now)
      const { lastInsertRowid } = db
        .prepare('INSERT INTO messages (channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?)')
        .run(channelId, userId, text, now)
      sendTo(serverMemberIds(sid), { t: 'message', message: messageDto(Number(lastInsertRowid)) })
    } else if (msg.t === 'typing') {
      const key = `${userId}:${channelId}`
      const now = Date.now()
      if ((lastTyping.get(key) ?? 0) > now - 2000) return
      lastTyping.set(key, now)
      sendTo(serverMemberIds(sid).filter((id) => id !== userId), { t: 'typing', channelId, userId })
    }
  })

  ws.on('close', () => {
    leaveVoice(userId, ws)
    online.get(userId)?.delete(ws)
    if (!isOnline(userId)) {
      online.delete(userId)
      sendTo(peers(), { t: 'presence', userId, status: 'offline' })
    }
  })
})

http.listen(PORT, HOST, () => {
  console.log(`Papo no ar em http://${HOST}:${PORT}`)
  if (HOST !== '127.0.0.1') console.log('Atenção: escutando fora do localhost. Prefira usar `tailscale serve`.')
})
