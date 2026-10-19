export type ChannelKind = 'text' | 'voice'
export type Status = 'online' | 'offline'

export interface Channel { id: number; name: string; kind: ChannelKind }
export interface Category { name: string; channels: Channel[] }
export interface Member { id: number; name: string; color: string; role: string; status: Status }
export interface Server {
  id: number
  name: string
  color: string
  isOwner: boolean
  inviteCode?: string
  categories: Category[]
  members: Member[]
  /** canal de voz -> ids de quem está na sala */
  voice: Record<number, number[]>
}
export interface Me { id: number; name: string; color: string }
export interface Bootstrap { me: Me; servers: Server[]; voiceEnabled: boolean }
export interface Message { id: number; channelId: number; authorId: number; text: string; createdAt: number }

const TOKEN_KEY = 'papo.token'
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* sem storage */ }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? 'Erro inesperado', res.status)
  return data as T
}

export const api = {
  register: (username: string, password: string, inviteCode: string) =>
    request<{ token: string }>('/api/register', { body: { username, password, inviteCode } }),
  login: (username: string, password: string) =>
    request<{ token: string }>('/api/login', { body: { username, password } }),
  logout: () => request('/api/logout', { method: 'POST', body: {} }),
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  messages: (channelId: number) => request<Message[]>(`/api/channels/${channelId}/messages`),
  renameServer: (id: number, name: string) => request(`/api/servers/${id}`, { method: 'PATCH', body: { name } }),
  removeMember: (serverId: number, userId: number | 'me') => request(`/api/servers/${serverId}/members/${userId}`, { method: 'DELETE' }),
  deleteServer: (id: number) => request(`/api/servers/${id}`, { method: 'DELETE' }),
  renameChannel: (id: number, name: string) => request(`/api/channels/${id}`, { method: 'PATCH', body: { name } }),
  deleteChannel: (id: number) => request(`/api/channels/${id}`, { method: 'DELETE' }),
  voiceToken: (channelId: number) => request<{ token: string }>('/api/voice/token', { body: { channelId } }),
  createServer: (name: string) => request<{ id: number }>('/api/servers', { body: { name } }),
  joinServer: (code: string) => request<{ id: number }>('/api/servers/join', { body: { code } }),
  createChannel: (serverId: number, name: string, kind: ChannelKind) =>
    request<{ id: number }>(`/api/servers/${serverId}/channels`, { body: { name, kind } }),
}

export type ServerEvent =
  | { t: 'message'; message: Message }
  | { t: 'presence'; userId: number; status: Status }
  | { t: 'typing'; channelId: number; userId: number }
  | { t: 'voice'; channelId: number; users: number[] }
  | { t: 'removed'; serverName: string; kicked: boolean }
  | { t: 'refresh' }

/** WebSocket com reconexão automática. Retorna função de envio e de encerramento. */
export function connectSocket(
  onEvent: (e: ServerEvent) => void,
  onState: (open: boolean) => void,
) {
  let ws: WebSocket | null = null
  let closed = false
  let retry = 0
  let timer: number | undefined

  const open = () => {
    const token = getToken()
    if (!token || closed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws?token=${token}`)
    ws.onopen = () => { retry = 0; onState(true) }
    ws.onmessage = (ev) => {
      try { onEvent(JSON.parse(ev.data)) } catch { /* ignora */ }
    }
    ws.onclose = (ev) => {
      onState(false)
      if (closed || ev.code === 4401) return
      timer = window.setTimeout(open, Math.min(1000 * 2 ** retry++, 15000))
    }
  }
  open()

  return {
    send: (payload: unknown) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(payload)),
    close: () => { closed = true; window.clearTimeout(timer); ws?.close() },
  }
}
