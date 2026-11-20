import express from 'express'
import { createServer as createHttp } from 'node:http'
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import httpProxy from 'http-proxy'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { db, createServer, pickColor } from './db.ts'
import {
  createSession, hashPassword, rateLimit, requireAuth, userFromToken, verifyPassword, type AuthedRequest,
} from './auth.ts'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '127.0.0.1'
// Voz, vídeo e tela (LiveKit). Só ligam se as chaves vierem do ambiente.
const LK_KEY = process.env.LIVEKIT_API_KEY
const LK_SECRET = process.env.LIVEKIT_API_SECRET
const LK_TARGET = process.env.LIVEKIT_TARGET ?? 'http://127.0.0.1:7880'
const VOICE_ENABLED = !!(LK_KEY && LK_SECRET)
// Servidor público (atrás de um proxy HTTPS, como o Traefik do EasyPanel ou o Caddy):
// - TRUST_PROXY: em quem confiar para ler o IP real de quem chega (ex.: "uniquelocal" na rede do Docker).
//   Sem isso, o limite de tentativas enxergaria todo mundo como o IP do proxy.
// - PAPO_SETUP_CODE: se definido, a PRIMEIRA conta (a dona do servidor) só é criada com esse código.
//   Sem isso, qualquer pessoa que abrisse o endereço antes de você viraria a dona.
const TRUST_PROXY = process.env.TRUST_PROXY
const SETUP_CODE = process.env.PAPO_SETUP_CODE

const app = express()
app.disable('x-powered-by')
if (TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY)

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// O navegador fala com o LiveKit por /lk (mesma porta e mesmo HTTPS do Papo).
const lkProxy = httpProxy.createProxyServer({ target: LK_TARGET, ws: true, changeOrigin: false })
lkProxy.on('error', (_err, _req, res) => {
  if ('writeHead' in res && !res.headersSent) { res.writeHead(502); res.end('LiveKit indisponível') }
  else if ('destroy' in res) res.destroy()
})
if (VOICE_ENABLED) app.use('/lk', (req, res) => lkProxy.web(req, res))

app.use(express.json({ limit: '32kb' }))

// Sem login e sem dados: só confirma que este servidor do Papo está no ar (a imagem Docker usa isto como teste de saúde).
app.get('/api/health', (_req, res) => res.json({ papo: true }))

// ---------- helpers ----------
const one = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as T | undefined

// ---------- contas ----------
// Quem tem conta pode criar sessões. A conta se cria com um código de convite (o do dono); a primeira, a do dono,
// só com o PAPO_SETUP_CODE, se ele existir. Entrar numa sessão não precisa de conta.
const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,24}$/u

app.post('/api/register', rateLimit(10, 60_000), (req, res) => {
  const { username, password, inviteCode } = req.body ?? {}
  if (typeof username !== 'string' || !USERNAME_RE.test(username))
    return res.status(400).json({ error: 'Nome de usuário: 2 a 24 letras, números, _ . -' })
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' })

  const first = one<{ n: number }>('SELECT COUNT(*) n FROM users')!.n === 0
  let invite: { id: number } | undefined
  if (first && SETUP_CODE && !(typeof inviteCode === 'string' && sameSecret(inviteCode.trim(), SETUP_CODE)))
    return res.status(403).json({ error: 'Este servidor ainda não foi configurado. Use o código de configuração do dono.' })
  if (!first) {
    invite = typeof inviteCode === 'string' ? one<{ id: number }>('SELECT id FROM servers WHERE invite_code = ?', inviteCode.trim()) : undefined
    if (!invite) return res.status(403).json({ error: 'Código de convite inválido' })
  }
  if (one('SELECT 1 FROM users WHERE username = ?', username)) return res.status(409).json({ error: 'Esse nome já está em uso' })

  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, color, created_at) VALUES (?, ?, ?, ?)')
    .run(username, hashPassword(password), pickColor(Date.now() % 997), Date.now())
  const userId = Number(lastInsertRowid)
  if (first) createServer('Papo', userId) // guarda o código de convite do dono
  else db.prepare("INSERT INTO members (server_id, user_id, role) VALUES (?, ?, 'member')").run(invite!.id, userId)
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

/** Quem sou eu. O código de convite para novas contas só vem para o dono. */
app.get('/api/me', requireAuth, (req, res) => {
  const userId = (req as AuthedRequest).userId
  const me = one<{ id: number; username: string }>('SELECT id, username FROM users WHERE id = ?', userId)!
  const owned = one<{ invite_code: string }>('SELECT invite_code FROM servers WHERE owner_id = ? ORDER BY id LIMIT 1', userId)
  res.json({ me: { id: me.id, name: me.username }, inviteCode: owned?.invite_code })
})

// ---------- sessões por link ----------
// Uma pessoa com conta cria a sessão; quem tem o código entra só com um nome (convidado). A sala do
// LiveKit é "s-<código>". Sem WebSocket do Papo: convidados não têm conta nem presença no chat.
const SESSION_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // sem i, l, o, 0 e 1, que se confundem ao digitar
const SESSION_TTL_MS = 12 * 3600_000
const MAX_ACTIVE_SESSIONS = 3 // por conta, para ninguém lotar o servidor de salas
const GUEST_NAME_RE = /^[^\p{C}]{1,24}$/u // 1 a 24 caracteres, sem controle

const newSessionCode = () => Array.from({ length: 12 }, () => SESSION_ALPHABET[randomInt(SESSION_ALPHABET.length)]).join('')

/** Aceita "abcd-efgh-jkmn", em maiúsculas ou sem traços. Devolve o código normalizado ou null. */
function parseSessionCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  return c.length === 12 && [...c].every((ch) => SESSION_ALPHABET.includes(ch)) ? c : null
}

const activeSession = (code: string) =>
  one<{ code: string; creator_id: number; expires_at: number }>(
    'SELECT code, creator_id, expires_at FROM link_sessions WHERE code = ? AND ended_at IS NULL AND expires_at > ?', code, Date.now())

const optionalUser = (req: express.Request) => userFromToken(req.headers.authorization?.replace(/^Bearer /, ''))
const sessionNotFound = { error: 'Sessão não encontrada ou encerrada' }

// Limpeza das sessões antigas (de hoje em diante só as vencidas há mais de 7 dias, para depurar).
const purgeOldSessions = () => db.prepare('DELETE FROM link_sessions WHERE expires_at < ?').run(Date.now() - 7 * 86400_000)
purgeOldSessions()
setInterval(purgeOldSessions, 3600_000).unref()

app.post('/api/sessions', requireAuth, rateLimit(10, 60_000), (req, res) => {
  if (!VOICE_ENABLED) return res.status(503).json({ error: 'Voz e vídeo não estão ativos neste servidor' })
  const userId = (req as AuthedRequest).userId
  const active = one<{ n: number }>('SELECT COUNT(*) n FROM link_sessions WHERE creator_id = ? AND ended_at IS NULL AND expires_at > ?', userId, Date.now())!.n
  if (active >= MAX_ACTIVE_SESSIONS)
    return res.status(429).json({ error: `Você já tem ${MAX_ACTIVE_SESSIONS} sessões ativas. Encerre uma antes de criar outra.` })
  const now = Date.now()
  for (let tries = 0; tries < 5; tries++) {
    const code = newSessionCode()
    try {
      db.prepare('INSERT INTO link_sessions (code, creator_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(code, userId, now, now + SESSION_TTL_MS)
      return res.json({ code, expiresAt: now + SESSION_TTL_MS })
    } catch { /* código repetido (muito raro): tenta outro */ }
  }
  res.status(500).json({ error: 'Não consegui criar a sessão. Tente de novo.' })
})

app.get('/api/sessions/:code', rateLimit(60, 60_000), async (req, res) => {
  const code = parseSessionCode(req.params.code)
  const s = code ? activeSession(code) : undefined
  if (!code || !s) return res.status(404).json(sessionNotFound)
  const userId = optionalUser(req)
  const me = userId ? one<{ username: string }>('SELECT username FROM users WHERE id = ?', userId) : undefined
  let participants: number | undefined
  if (VOICE_ENABLED) {
    try { participants = (await new RoomServiceClient(LK_TARGET, LK_KEY!, LK_SECRET!).listParticipants(`s-${code}`)).length } catch { /* sala ainda vazia ou LiveKit fora */ }
  }
  res.json({ code, expiresAt: s.expires_at, isCreator: userId === s.creator_id, me: me ? { name: me.username } : null, participants })
})

app.post('/api/sessions/:code/token', rateLimit(30, 60_000), async (req, res) => {
  if (!VOICE_ENABLED) return res.status(503).json({ error: 'Voz e vídeo não estão ativos neste servidor' })
  const code = parseSessionCode(req.params.code)
  const s = code ? activeSession(code) : undefined
  if (!code || !s) return res.status(404).json(sessionNotFound)
  const userId = optionalUser(req)
  const user = userId ? one<{ username: string }>('SELECT username FROM users WHERE id = ?', userId) : undefined
  let identity: string, name: string
  if (user && userId) {
    identity = `u-${userId}`; name = user.username // quem tem conta entra com o nome da conta
  } else {
    name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!GUEST_NAME_RE.test(name)) return res.status(400).json({ error: 'Escolha um nome de 1 a 24 caracteres' })
    identity = `g-${randomBytes(6).toString('hex')}`
  }
  const ttl = Math.max(60, Math.min(6 * 3600, Math.floor((s.expires_at - Date.now()) / 1000)))
  const at = new AccessToken(LK_KEY!, LK_SECRET!, { identity, name, ttl })
  at.addGrant({ room: `s-${code}`, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false })
  res.json({ token: await at.toJwt(), name })
})

app.delete('/api/sessions/:code', requireAuth, (req, res) => {
  const code = parseSessionCode(req.params.code)
  const s = code ? activeSession(code) : undefined
  if (!code || !s) return res.status(404).json(sessionNotFound)
  if (s.creator_id !== (req as AuthedRequest).userId) return res.status(403).json({ error: 'Só quem criou a sessão pode encerrá-la' })
  db.prepare('UPDATE link_sessions SET ended_at = ? WHERE code = ?').run(Date.now(), code)
  if (VOICE_ENABLED) new RoomServiceClient(LK_TARGET, LK_KEY!, LK_SECRET!).deleteRoom(`s-${code}`).catch(() => { /* sala vazia ou LiveKit fora */ })
  res.json({ ok: true })
})

// ---------- frontend (build) ----------
const dist = resolve(process.env.DIST_DIR ?? 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api|lk).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')))
}

// ---------- WebSocket do LiveKit (só o proxy /lk) ----------
const http = createHttp(app)

http.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  if (VOICE_ENABLED && pathname.startsWith('/lk/')) {
    req.url = req.url!.slice(3) // tira o prefixo /lk
    lkProxy.ws(req, socket, head)
  } else {
    socket.destroy()
  }
})

http.listen(PORT, HOST, () => {
  console.log(`Papo no ar em http://${HOST}:${PORT}`)
  if (HOST !== '127.0.0.1' && !TRUST_PROXY) console.log('Atenção: escutando fora do localhost. Ponha um proxy HTTPS na frente e defina TRUST_PROXY (veja docs/deploy-vps.md).')
  if (TRUST_PROXY && !SETUP_CODE && one<{ n: number }>('SELECT COUNT(*) n FROM users')!.n === 0)
    console.log('Atenção: servidor público sem PAPO_SETUP_CODE. Quem abrir o endereço primeiro vira o dono.')
})
