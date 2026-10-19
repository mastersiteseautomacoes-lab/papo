'use strict'
const { app, BrowserWindow, Menu, Notification, Tray, clipboard, desktopCapturer, ipcMain, nativeImage, session, shell } = require('electron')
const crypto = require('node:crypto')
const { execFile, fork } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')

const APP_ROOT = path.join(__dirname, '..')
const DEFAULT_PORT = 38080
const LAUNCHER = path.join(__dirname, 'launcher.html')

/** @type {BrowserWindow | null} */
let win = null
/** @type {import('node:child_process').ChildProcess | null} */
let serverProc = null
/** @type {import('node:child_process').ChildProcess | null} */
let livekitProc = null
/** @type {{ port: number, localUrl: string, publicUrl: string | null, tsError: string | null, voiceError: string | null } | null} */
let hosting = null
/** Origem atualmente aberta no chat (para permissões e navegação). */
let chatOrigin = null
/** @type {Tray | null} */
let tray = null
let quitting = false
let trayHintShown = false

const configFile = () => path.join(app.getPath('userData'), 'config.json')
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configFile(), 'utf8')) } catch { return {} }
}
function writeConfig(patch) {
  try { fs.writeFileSync(configFile(), JSON.stringify({ ...readConfig(), ...patch }, null, 2)) } catch { /* ignora */ }
}

// ---------- Tailscale ----------
function tailscaleExe() {
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Tailscale', 'tailscale.exe'),
  ]
  return candidates.find((p) => fs.existsSync(p)) || 'tailscale'
}

function runTailscale(args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(tailscaleExe(), args, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || ''), err: String(stderr || '') + (err && !stderr ? err.message : '') })
    })
  })
}

async function tailscaleDnsName() {
  const r = await runTailscale(['status', '--json'], 10000)
  if (!r.ok) return { error: 'Não encontrei o Tailscale. Instale em tailscale.com/download e entre com a sua conta.' }
  try {
    const s = JSON.parse(r.out)
    if (s.BackendState !== 'Running') return { error: 'O Tailscale não está conectado. Abra o Tailscale e entre com a sua conta.' }
    const name = String(s.Self?.DNSName || '').replace(/\.$/, '')
    return name ? { name } : { error: 'O Tailscale não informou o nome deste computador.' }
  } catch {
    return { error: 'Não consegui ler o estado do Tailscale.' }
  }
}

// ---------- LiveKit (voz, vídeo e tela) ----------
// PAPO_LK_PORT permite rodar mais de um anfitrião na mesma máquina (testes).
const LK_HTTP_PORT = Number(process.env.PAPO_LK_PORT || 7880)
const LK_TCP_PORT = LK_HTTP_PORT + 1
const LK_UDP_PORT = LK_HTTP_PORT + 2

function tcpPortFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.once('listening', () => s.close(() => resolve(true)))
    s.listen(port, '0.0.0.0')
  })
}

function livekitBinary() {
  const name = process.platform === 'win32' ? 'livekit-server.exe' : 'livekit-server'
  return path.join(APP_ROOT, 'vendor', name)
}

function livekitKeys() {
  const cfg = readConfig()
  if (cfg.lkKey && cfg.lkSecret) return { key: cfg.lkKey, secret: cfg.lkSecret }
  const keys = { key: 'papo' + crypto.randomBytes(6).toString('hex'), secret: crypto.randomBytes(32).toString('hex') }
  writeConfig({ lkKey: keys.key, lkSecret: keys.secret })
  return keys
}

async function tailscaleIPv4() {
  const r = await runTailscale(['ip', '-4'], 8000)
  const ip = r.ok ? r.out.split(/\r?\n/).map((l) => l.trim()).find((l) => /^\d+\.\d+\.\d+\.\d+$/.test(l)) : null
  return ip || null
}

/** Sobe o livekit-server. Retorna { keys } se deu certo ou { error } com o motivo. */
async function livekitStart(tsIp) {
  const bin = livekitBinary()
  if (!fs.existsSync(bin)) return { error: 'O servidor de voz (livekit-server) não está incluído neste app.' }
  // Se as portas já estão em uso (ex.: outro Papo aberto neste computador), não confunda o servidor de outro com o nosso.
  if (!(await tcpPortFree(LK_HTTP_PORT)) || !(await tcpPortFree(LK_TCP_PORT))) {
    return { error: `As portas de voz (${LK_HTTP_PORT} e ${LK_TCP_PORT}) já estão em uso. Há outro Papo aberto neste computador?` }
  }
  const keys = livekitKeys()
  const lines = [
    `port: ${LK_HTTP_PORT}`,
    'bind_addresses:',
    '  - 127.0.0.1',
    'rtc:',
    `  tcp_port: ${LK_TCP_PORT}`,
    `  udp_port: ${LK_UDP_PORT}`,
    '  use_external_ip: false',
  ]
  if (tsIp) lines.push(`  node_ip: ${tsIp}`, '  ips:', '    includes:', '      - 100.64.0.0/10', '      - 127.0.0.1/32')
  lines.push('keys:', `  ${keys.key}: ${keys.secret}`, 'logging:', '  level: warn')
  const cfgFile = path.join(app.getPath('userData'), 'livekit.yaml')
  fs.writeFileSync(cfgFile, lines.join('\n') + '\n')

  livekitProc = require('node:child_process').spawn(bin, ['--config', cfgFile], { stdio: 'ignore', windowsHide: true })
  let exited = false
  livekitProc.once('exit', () => { exited = true; livekitProc = null })
  livekitProc.once('error', () => { exited = true; livekitProc = null })
  const end = Date.now() + 10000
  while (Date.now() < end && !exited) {
    try {
      const r = await fetch(`http://127.0.0.1:${LK_HTTP_PORT}`)
      if (r.ok) { await new Promise((res) => setTimeout(res, 400)); if (!exited) return { keys } }
    } catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  livekitStop()
  return { error: `O servidor de voz não iniciou (as portas ${LK_HTTP_PORT}, ${LK_TCP_PORT} e ${LK_UDP_PORT} estão livres?).` }
}

function livekitStop() {
  if (livekitProc) { livekitProc.removeAllListeners('exit'); livekitProc.kill(); livekitProc = null }
}

// ---------- Servidor embutido ----------
function freePort(preferred) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const s = net.createServer()
      s.once('error', () => (port === 0 ? resolve(0) : tryPort(0)))
      s.once('listening', () => { const p = s.address().port; s.close(() => resolve(p)) })
      s.listen(port, '127.0.0.1')
    }
    tryPort(preferred)
  })
}

async function waitFor(url, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return true } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

async function hostStart() {
  if (hosting) return { ok: true, ...hosting }
  const cfg = readConfig()
  const port = await freePort(cfg.hostPort || DEFAULT_PORT)
  if (!port) return { ok: false, error: 'Não encontrei uma porta livre.' }
  writeConfig({ hostPort: port })

  const dataDir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const serverFile = path.join(APP_ROOT, 'build', 'server.cjs')
  if (!fs.existsSync(serverFile)) return { ok: false, error: 'Arquivo do servidor ausente (build/server.cjs).' }

  // Voz: sobe o LiveKit antes do servidor, que só habilita a voz se as chaves existirem.
  const tsIp = process.env.PAPO_SKIP_TAILSCALE ? null : await tailscaleIPv4()
  const lk = await livekitStart(tsIp)
  const voiceError = lk.error || (!tsIp && !process.env.PAPO_SKIP_TAILSCALE ? 'Sem Tailscale, a voz só funciona neste computador.' : null)

  serverProc = fork(serverFile, [], {
    env: {
      ...process.env,
      ...(lk.keys ? { LIVEKIT_API_KEY: lk.keys.key, LIVEKIT_API_SECRET: lk.keys.secret, LIVEKIT_TARGET: `http://127.0.0.1:${LK_HTTP_PORT}` } : {}),
      ELECTRON_RUN_AS_NODE: '1',
      NODE_NO_WARNINGS: '1',
      PORT: String(port),
      HOST: '127.0.0.1',
      DB_FILE: path.join(dataDir, 'papo.db'),
      DIST_DIR: path.join(APP_ROOT, 'dist'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  serverProc.once('exit', () => { serverProc = null; hosting = null })

  const localUrl = `http://127.0.0.1:${port}`
  if (!(await waitFor(localUrl))) {
    hostStop()
    return { ok: false, error: 'O servidor não respondeu. Tente novamente.' }
  }

  let publicUrl = null
  let tsError = null
  // PAPO_SKIP_TAILSCALE=1: só para testes, não mexe no Tailscale da máquina.
  const ts = process.env.PAPO_SKIP_TAILSCALE ? { error: 'Tailscale ignorado (modo de teste).' } : await tailscaleDnsName()
  if (ts.error) tsError = ts.error
  else {
    const r = await runTailscale(['serve', '--bg', String(port)])
    if (r.ok) publicUrl = `https://${ts.name}`
    else if (/https/i.test(r.err + r.out) && /(enable|not enabled|disabled)/i.test(r.err + r.out))
      tsError = 'Ative "HTTPS Certificates" na aba DNS do painel do Tailscale (login.tailscale.com).'
    else tsError = `Falha ao publicar no Tailscale: ${(r.err || r.out).trim().slice(0, 200)}`
  }
  hosting = { port, localUrl, publicUrl, tsError, voiceError }
  return { ok: true, ...hosting }
}

function hostStop() {
  const had = !!hosting
  if (serverProc) { serverProc.removeAllListeners('exit'); serverProc.kill(); serverProc = null }
  livekitStop()
  hosting = null
  if (had && !process.env.PAPO_SKIP_TAILSCALE) runTailscale(['serve', '--https=443', 'off'], 8000)
}

// ---------- Amigos (rastro de servidores no ar) ----------
const FRIEND_POLL_MS = 30000
const MAX_FRIENDS = 30
/** @type {Map<string, boolean>} origem -> último estado conhecido (true = no ar) */
const friendStatus = new Map()
let friendTimer = null

function readFriends() {
  const list = readConfig().friends
  return Array.isArray(list) ? list.filter((f) => f && typeof f.url === 'string' && typeof f.name === 'string') : []
}

async function pingServer(origin) {
  try {
    const r = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    return r.status < 500 // servidores de versões antigas respondem 404, mas estão no ar
  } catch {
    return false
  }
}

function friendsSnapshot() {
  return readFriends().map((f) => ({ ...f, online: friendStatus.get(f.url) ?? null }))
}

async function pollFriends() {
  const friends = readFriends()
  const own = hosting?.publicUrl ? new URL(hosting.publicUrl).origin : null
  const results = await Promise.all(friends.map(async (f) => [f, f.url === own ? false : await pingServer(f.url)]))
  const current = new Set(friends.map((f) => f.url))
  for (const url of [...friendStatus.keys()]) if (!current.has(url)) friendStatus.delete(url)
  for (const [f, up] of results) {
    const before = friendStatus.get(f.url)
    friendStatus.set(f.url, up)
    // Só avisa quando vimos o servidor cair e voltar; o primeiro teste da sessão é silencioso.
    if (up && before === false && Notification.isSupported()) {
      const n = new Notification({ title: `${f.name} está no ar`, body: 'O servidor dele no Papo acabou de ficar online. Clique para entrar.', icon: path.join(APP_ROOT, 'assets', 'icon.png') })
      n.on('click', () => { showWindow(); openChat(f.url) })
      n.show()
    }
  }
  if (win && !win.isDestroyed() && !chatOrigin) win.webContents.send('papo:friends', friendsSnapshot())
}

function startFriendPolling() {
  if (friendTimer) return
  pollFriends()
  friendTimer = setInterval(pollFriends, FRIEND_POLL_MS)
}

// ---------- Janela ----------
function isAllowedUrl(raw) {
  try {
    const u = new URL(raw)
    if (u.protocol === 'https:') return true
    // http só para localhost ou IPs do Tailscale (100.64.0.0/10)
    if (u.protocol === 'http:') {
      if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return true
      const m = u.hostname.match(/^100\.(\d+)\.\d+\.\d+$/)
      return !!m && Number(m[1]) >= 64 && Number(m[1]) <= 127
    }
  } catch { /* inválida */ }
  return false
}

function normalizeAddress(input) {
  let s = String(input || '').trim()
  if (!s) return null
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`
  try { const u = new URL(s); return isAllowedUrl(u.href) ? u.origin : null } catch { return null }
}

function openChat(url) {
  if (!win) return
  chatOrigin = new URL(url).origin
  win.loadURL(url)
}

function openLauncher() {
  chatOrigin = null
  win?.loadFile(LAUNCHER)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#111214',
    icon: path.join(APP_ROOT, 'assets', 'icon.png'),
    title: 'Papo',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.on('closed', () => { win = null })
  // Hospedando: o X esconde a janela na bandeja e o servidor continua no ar.
  win.on('close', (e) => {
    if (quitting || !hosting) return
    e.preventDefault()
    win.hide()
    if (!trayHintShown) {
      trayHintShown = true
      tray?.displayBalloon({
        title: 'O Papo continua rodando',
        content: 'O servidor segue no ar. Para encerrar, clique com o botão direito no ícone da bandeja e escolha Sair.',
      })
    }
  })

  // Links externos abrem no navegador padrão; o app não sai do servidor atual.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const target = (() => { try { return new URL(url) } catch { return null } })()
    if (!target) return e.preventDefault()
    if (target.protocol === 'file:' || (chatOrigin && target.origin === chatOrigin)) return
    e.preventDefault()
    if (/^https?:/i.test(url)) shell.openExternal(url)
  })

  openLauncher()
}

function showWindow() {
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(APP_ROOT, 'assets', 'icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  tray.setToolTip('Papo')
  tray.on('click', showWindow)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Papo', click: showWindow },
    {
      label: 'Copiar endereço para convidar',
      click: () => { const u = hosting?.publicUrl || hosting?.localUrl; if (u) clipboard.writeText(u) },
    },
    { type: 'separator' },
    { label: 'Sair (desliga o servidor)', click: () => app.quit() },
  ]))
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Papo',
      submenu: [
        { label: 'Início (trocar de servidor)', accelerator: 'CmdOrCtrl+Shift+H', click: openLauncher },
        {
          label: 'Copiar endereço para convidar',
          click: () => { const u = hosting?.publicUrl || hosting?.localUrl; if (u) clipboard.writeText(u) },
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  ]))
}

// ---------- IPC (só a janela do app, e só o launcher chama) ----------
function fromLauncher(e) {
  return e.senderFrame?.url?.startsWith('file:') && e.senderFrame.url.endsWith('launcher.html')
}

ipcMain.handle('papo:state', (e) => {
  if (!fromLauncher(e)) return null
  const cfg = readConfig()
  return { lastJoin: cfg.lastJoin || '', hosting, friends: friendsSnapshot() }
})
ipcMain.handle('papo:friend-add', (e, name, address) => {
  if (!fromLauncher(e)) return { ok: false, error: 'negado' }
  const origin = normalizeAddress(address)
  if (!origin) return { ok: false, error: 'Endereço inválido. Use algo como https://nome-do-pc.tailnet.ts.net' }
  const label = String(name || '').trim().slice(0, 40)
  if (!label) return { ok: false, error: 'Dê um nome para o seu amigo.' }
  const friends = readFriends()
  if (friends.some((f) => f.url === origin)) return { ok: false, error: 'Esse endereço já está na lista.' }
  if (friends.length >= MAX_FRIENDS) return { ok: false, error: `O limite é ${MAX_FRIENDS} amigos.` }
  writeConfig({ friends: [...friends, { name: label, url: origin }] })
  pollFriends()
  return { ok: true, friends: friendsSnapshot() }
})
ipcMain.handle('papo:friend-remove', (e, address) => {
  if (!fromLauncher(e)) return []
  writeConfig({ friends: readFriends().filter((f) => f.url !== address) })
  friendStatus.delete(address)
  return friendsSnapshot()
})
ipcMain.handle('papo:friend-refresh', async (e) => {
  if (!fromLauncher(e)) return []
  await pollFriends()
  return friendsSnapshot()
})
ipcMain.handle('papo:host-start', async (e) => (fromLauncher(e) ? hostStart() : { ok: false, error: 'negado' }))
ipcMain.handle('papo:host-stop', (e) => { if (fromLauncher(e)) hostStop(); return true })
ipcMain.handle('papo:host-open', (e) => {
  if (!fromLauncher(e) || !hosting) return false
  openChat(hosting.localUrl)
  return true
})
ipcMain.handle('papo:join', (e, address) => {
  if (!fromLauncher(e)) return { ok: false, error: 'negado' }
  const origin = normalizeAddress(address)
  if (!origin) return { ok: false, error: 'Endereço inválido. Use algo como https://nome-do-pc.tailnet.ts.net' }
  writeConfig({ lastJoin: origin })
  openChat(origin)
  return { ok: true }
})
// Seta "voltar" da tela de login do servidor aberto: só a página do servidor atual pode pedir, e só leva ao início.
ipcMain.handle('papo:home', (e) => {
  let origin = ''
  try { origin = new URL(e.senderFrame?.url || '').origin } catch { /* ignora */ }
  if (!chatOrigin || origin !== chatOrigin) return false
  openLauncher()
  return true
})
ipcMain.handle('papo:copy', (e, text) => {
  if (fromLauncher(e) && typeof text === 'string') clipboard.writeText(text.slice(0, 500))
  return true
})

// ---------- Ciclo de vida ----------
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)
  app.whenReady().then(() => {
    // Microfone, câmera e tela só para o servidor que o usuário abriu (voz e vídeo virão depois).
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
      const ok = ['media', 'display-capture', 'clipboard-sanitized-write'].includes(permission)
      let origin = ''
      try { origin = new URL(details.requestingUrl).origin } catch { /* ignora */ }
      cb(ok && !!chatOrigin && origin === chatOrigin)
    })
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
        if (!sources.length) return callback({})
        const screens = sources.filter((x) => x.id.startsWith('screen:'))
        const windows = sources.filter((x) => x.id.startsWith('window:') && x.name.trim())
        let chosen = false
        const pick = (src) => () => { chosen = true; callback({ video: src, audio: process.platform === 'win32' ? 'loopback' : undefined }) }
        const template = [
          { label: 'Compartilhar a tela inteira', enabled: false },
          ...screens.map((x, i) => ({ label: x.name || `Tela ${i + 1}`, click: pick(x) })),
          { type: 'separator' },
          { label: 'Ou uma janela', enabled: false },
          ...windows.slice(0, 25).map((x) => ({ label: x.name.length > 60 ? x.name.slice(0, 57) + '…' : x.name, click: pick(x) })),
        ]
        const menu = Menu.buildFromTemplate(template)
        menu.popup({ window: win || undefined, callback: () => { if (!chosen) callback({}) } })
      } catch {
        callback({})
      }
    })
    app.setAppUserModelId('br.papo.chat')
    buildMenu()
    createTray()
    createWindow()
    startFriendPolling()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => { quitting = true; clearInterval(friendTimer); hostStop(); tray?.destroy() })
}
