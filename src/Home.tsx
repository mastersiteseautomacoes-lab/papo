import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Check, ChevronDown, ClipboardPaste, Copy, LogOut, Plus } from 'lucide-react'
import { api, ApiError, getToken, setToken } from './api'
import Login from './Login'
import { copyText, extractCode, normalizeCode } from './Session'

const CODE_LEN = 12

/** 12 caixas em 3 grupos de 4: digita, apaga e cola (o código ou o link inteiro). */
function CodeInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(CODE_LEN - 1, i))]?.focus()

  function type(i: number, raw: string) {
    const ch = raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-1)
    if (!ch) return
    const at = Math.min(i, value.length) // o caractere entra sempre logo depois do último já digitado
    onChange((value.slice(0, at) + ch + value.slice(at + 1)).slice(0, CODE_LEN))
    focusAt(at + 1)
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit(); return }
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (i < value.length) onChange(value.slice(0, i) + value.slice(i + 1))
      else { onChange(value.slice(0, -1)); focusAt(i - 1) }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(i + 1) }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const next = extractCode(text) ?? normalizeCode(text).slice(0, CODE_LEN)
    onChange(next)
    focusAt(next.length >= CODE_LEN ? CODE_LEN - 1 : next.length)
  }

  return (
    <div className="code-boxes" role="group" aria-label="Código da sessão">
      {[0, 1, 2].map((g) => (
        <div className="code-group" key={g}>
          {[0, 1, 2, 3].map((k) => {
            const i = g * 4 + k
            return (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el }}
                className={`code-box ${value[i] ? 'filled' : ''}`}
                value={value[i] ?? ''}
                maxLength={2}
                inputMode="text"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus={i === 0}
                aria-label={`Caractere ${i + 1} do código`}
                onChange={(e) => type(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={onPaste}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Tela inicial: entrar numa sessão com o código de 12 letras (sem conta) ou criar uma (com conta). */
export default function Home() {
  const [authed, setAuthed] = useState(() => !!getToken())
  const [showLogin, setShowLogin] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState<{ name: string; invite?: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const canPaste = typeof navigator.clipboard?.readText === 'function'

  useEffect(() => {
    if (!authed) { setAccount(null); return }
    let alive = true
    api.me()
      .then((b) => { if (alive) setAccount({ name: b.me.name, invite: b.inviteCode }) })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) { setToken(null); if (alive) setAuthed(false) } })
    return () => { alive = false }
  }, [authed])

  function join() {
    const c = extractCode(code)
    if (!c) return setError('O código tem 12 letras e números, como abcd-efgh-jkmn.')
    location.assign(`/j/${c}`)
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText()
      setCode(extractCode(t) ?? normalizeCode(t).slice(0, CODE_LEN))
      setError('')
    } catch { setError('Não consegui ler a área de transferência. Clique numa caixa e use Ctrl+V.') }
  }

  async function create() {
    if (!authed) { setShowLogin(true); return }
    setBusy(true); setError('')
    try {
      const { code: c } = await api.createSession()
      location.assign(`/j/${c}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setToken(null); setAuthed(false); setShowLogin(true) }
      else setError(e instanceof Error ? e.message : 'Não consegui criar a sessão.')
      setBusy(false)
    }
  }

  async function logout() {
    try { await api.logout() } catch { /* sessão já expirada */ }
    setToken(null); setAuthed(false); setAccount(null); setMenuOpen(false)
  }

  async function copyInvite() {
    if (account?.invite && await copyText(account.invite)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  }

  if (showLogin) return <Login onDone={() => { setAuthed(true); setShowLogin(false) }} onBack={() => setShowLogin(false)} />

  return (
    <div className="home" onClick={() => setMenuOpen(false)}>
      <header className="home-top">
        <span />
        {account ? (
          <div className="home-account" onClick={(e) => e.stopPropagation()}>
            <button className="session-btn" onClick={() => setMenuOpen((o) => !o)}>
              <span className="avatar small">{account.name[0]?.toUpperCase()}</span> {account.name} <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="home-menu">
                {account.invite && (
                  <div className="home-invite">
                    <small>Convite para criar contas</small>
                    <div><code>{account.invite}</code>
                      <button className="session-btn" onClick={copyInvite}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}</button>
                    </div>
                    <small className="muted">Quem tem uma conta pode criar sessões. Mande só para quem você confia.</small>
                  </div>
                )}
                <button className="menu-btn" onClick={logout}><LogOut size={16} /> Sair</button>
              </div>
            )}
          </div>
        ) : (
          <button className="session-btn" onClick={() => setShowLogin(true)}>Entrar na conta</button>
        )}
      </header>

      <main className="home-main">
        <div className="home-card">
          <img src="/logo.png" alt="" width={72} height={72} className="auth-logo" />
          <h1>Entre numa sessão</h1>
          <p className="muted">Digite o código de 12 letras e números que você recebeu. Não precisa de conta.</p>
          <CodeInput value={code} onChange={(v) => { setCode(v); setError('') }} onSubmit={join} />
          <div className="home-actions">
            {canPaste && <button className="session-btn" onClick={paste}><ClipboardPaste size={16} /> Colar</button>}
            <button className="primary" onClick={join} disabled={code.length < CODE_LEN}>Entrar</button>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="home-or"><span>ou</span></div>
          <button className="session-btn wide" onClick={create} disabled={busy}><Plus size={16} /> {busy ? 'Criando…' : 'Criar uma sessão'}</button>
          {!authed && <p className="muted small">Para criar uma sessão você precisa de uma conta.</p>}
        </div>
      </main>
    </div>
  )
}
