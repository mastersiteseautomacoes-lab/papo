import Home from './Home'
import { SessionPage } from './Session'

/**
 * Duas telas: a inicial (entrar com o código de 12 letras ou criar uma sessão) e a sessão (/j/<código>).
 * O chat de texto do Papo (servidores, canais e mensagens) foi retirado desta versão: ele continua na
 * tag `chat-completo-v0.6.2` e na branch `main`.
 */
export default function App() {
  const session = location.pathname.match(/^\/j\/([^/]+)\/?$/)
  if (session) return <SessionPage code={decodeURIComponent(session[1])} />
  return <Home />
}
