import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'

try {
  document.documentElement.className =
    `theme-${localStorage.getItem('papo.theme') || 'dark'} density-${localStorage.getItem('papo.density') || 'default'}`
} catch {
  document.documentElement.className = 'theme-dark density-default'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
