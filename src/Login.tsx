import { useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api, setToken } from './api'

// Só existe dentro do app instalado (Electron); no navegador a seta não aparece.
const goHome = (window as unknown as { papo?: { home?: () => Promise<boolean> } }).papo?.home

export default function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password, code)
      setToken(token)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      {goHome && (
        <button type="button" className="auth-back" onClick={() => goHome()} title="Voltar ao início (Hospedar / Entrar)">
          <ArrowLeft size={18} /> Início
        </button>
      )}
      <form className="auth-card" onSubmit={submit}>
        <img src="/logo.png" alt="" width={72} height={72} className="auth-logo" />
        <h1>{mode === 'login' ? 'Bem-vindo de volta!' : 'Criar conta'}</h1>
        <p className="muted">{mode === 'login' ? 'Que bom te ver de novo no Papo.' : 'O primeiro usuário do servidor não precisa de convite.'}</p>
        <label>Usuário
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" required />
        </label>
        <label>Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} required />
        </label>
        {mode === 'register' && (
          <label>Código de convite
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="deixe vazio se for o primeiro" />
          </label>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Registrar'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
          {mode === 'login' ? 'Precisa de uma conta? Registre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  )
}
