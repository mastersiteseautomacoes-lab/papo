'use strict'
const $ = (id) => document.getElementById(id)

function showError(id, text) {
  const el = $(id)
  el.textContent = text || ''
  el.hidden = !text
}

function renderHost(h) {
  $('host-idle').hidden = !!h
  $('host-running').hidden = !h
  if (!h) return
  $('host-url').textContent = h.publicUrl || h.localUrl
  const warn = [h.tsError && `${h.tsError} Por enquanto só este computador consegue entrar.`, h.voiceError].filter(Boolean).join(' ')
  $('host-warn').hidden = !warn
  $('host-warn').textContent = warn
}

$('host-start').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  btn.disabled = true
  btn.textContent = 'Iniciando…'
  showError('host-error', '')
  const r = await window.papo.hostStart()
  btn.disabled = false
  btn.textContent = 'Hospedar agora'
  if (!r.ok) return showError('host-error', r.error)
  renderHost(r)
})

$('host-stop').addEventListener('click', async () => {
  await window.papo.hostStop()
  renderHost(null)
})

$('host-open').addEventListener('click', () => window.papo.hostOpen())

$('host-copy').addEventListener('click', async (e) => {
  await window.papo.copy($('host-url').textContent)
  e.currentTarget.textContent = 'Copiado!'
  setTimeout(() => { e.currentTarget.textContent = 'Copiar' }, 1500)
})

$('join-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  showError('join-error', '')
  const r = await window.papo.join($('join-address').value)
  if (!r.ok) showError('join-error', r.error)
})

function renderFriends(list) {
  const ul = $('friends-list')
  ul.replaceChildren()
  $('friends-empty').hidden = list.length > 0
  for (const f of list) {
    const li = document.createElement('li')
    li.className = 'friend'
    const dot = document.createElement('span')
    dot.className = 'dot' + (f.online ? ' on' : '')
    const info = document.createElement('div')
    info.className = 'info'
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = f.name
    const addr = document.createElement('span')
    addr.className = 'addr'
    addr.textContent = f.url
    info.append(name, addr)
    const state = document.createElement('span')
    state.className = 'state' + (f.online ? ' on' : '')
    state.textContent = f.online === null ? 'verificando…' : f.online ? 'no ar' : 'fora do ar'
    const enter = document.createElement('button')
    enter.className = 'primary'
    enter.textContent = 'Entrar'
    enter.addEventListener('click', async () => {
      const r = await window.papo.join(f.url)
      if (!r.ok) showError('friend-error', r.error)
    })
    const remove = document.createElement('button')
    remove.className = 'ghost'
    remove.textContent = 'Remover'
    remove.addEventListener('click', async () => renderFriends(await window.papo.friendRemove(f.url)))
    li.append(dot, info, state, enter, remove)
    ul.append(li)
  }
}

$('friend-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  showError('friend-error', '')
  const r = await window.papo.friendAdd($('friend-name').value, $('friend-address').value)
  if (!r.ok) return showError('friend-error', r.error)
  $('friend-name').value = ''
  $('friend-address').value = ''
  renderFriends(r.friends)
})

$('friends-refresh').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  btn.disabled = true
  renderFriends(await window.papo.friendRefresh())
  btn.disabled = false
})

window.papo.onFriends(renderFriends)

window.papo.state().then((s) => {
  if (!s) return
  $('join-address').value = s.lastJoin || ''
  renderHost(s.hosting)
  renderFriends(s.friends || [])
})
