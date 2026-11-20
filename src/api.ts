export interface Me { id: number; name: string }
/** Sessão por link: `me` vem preenchido quando quem consulta tem conta. */
export interface SessionInfo { code: string; expiresAt: number; isCreator: boolean; me: { name: string } | null; participants?: number }

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
  /** Quem sou eu; `inviteCode` (para novas contas) só vem para o dono. */
  me: () => request<{ me: Me; inviteCode?: string }>('/api/me'),
  createSession: () => request<{ code: string; expiresAt: number }>('/api/sessions', { method: 'POST', body: {} }),
  sessionInfo: (code: string) => request<SessionInfo>(`/api/sessions/${encodeURIComponent(code)}`),
  sessionToken: (code: string, name?: string) =>
    request<{ token: string; name: string }>(`/api/sessions/${encodeURIComponent(code)}/token`, { body: { name } }),
  endSession: (code: string) => request(`/api/sessions/${encodeURIComponent(code)}`, { method: 'DELETE' }),
}
