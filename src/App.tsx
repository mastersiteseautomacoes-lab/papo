import Home from './Home'
import { SessionPage } from './Session'

/**
 * Duas telas: a inicial (entrar com o código de 12 letras ou criar uma sessão) e a sessão (/j/<código>).
 * O chat de texto do Papo (servidores, canais e mensagens) foi retirado na 0.7.0: ele continua só na
 * tag `chat-completo-v0.6.2`.
 */
export default function App() {
  const session = location.pathname.match(/^\/j\/([^/]+)\/?$/)
  if (session) return <SessionPage code={decodeURIComponent(session[1])} />
  return <Home />
}
