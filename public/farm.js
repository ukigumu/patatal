import { VILLAGERS } from './villagers.js'

const plants = document.querySelector('#plants')
const roster = document.querySelector('#roster')
const rosterWrap = document.querySelector('#roster-wrap')
const rosterToggle = document.querySelector('#roster-toggle')
const plaque = document.querySelector('#plaque')
const portrait = document.querySelector('#portrait')
const plaqueKind = document.querySelector('#plaque-kind')
const plaqueName = document.querySelector('#plaque-name')
const plaqueEn = document.querySelector('#plaque-en')
const toast = document.querySelector('#toast')
const status = document.querySelector('#status')

let toastTimer = 0
let activeId = ''

function plantEl(id) {
  return plants.querySelector(`[data-id="${id}"]`)
}

function rosterEl(id) {
  return roster.querySelector(`[data-id="${id}"]`)
}

function showPlaque(villager) {
  plaque.hidden = false
  plaqueKind.textContent = villager.kind === 'scarecrow' ? 'Orquestador' : 'Patata'
  plaqueName.textContent = villager.label
  plaqueEn.textContent = villager.name
  portrait.className = 'portrait'
  portrait.classList.add(villager.kind === 'scarecrow' ? 'sprite-scarecrow' : `sprite-${villager.sprite}`)
}

function hidePlaque() {
  if (activeId) return
  plaque.hidden = true
}

function setHot(id, on) {
  plantEl(id)?.classList.toggle('is-hot', on)
  rosterEl(id)?.classList.toggle('is-hot', on)
}

function hover(villager, on) {
  if (on) {
    showPlaque(villager)
    setHot(villager.id, true)
  } else {
    setHot(villager.id, false)
    hidePlaque()
  }
}

function speak(text, bad) {
  toast.hidden = false
  toast.textContent = text
  toast.classList.toggle('is-bad', Boolean(bad))
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.hidden = true
  }, 2400)
}

async function ping(villager) {
  activeId = villager.id
  showPlaque(villager)
  setHot(villager.id, true)
  const node = plantEl(villager.id)
  node?.classList.remove('is-ping')
  void node?.offsetWidth
  node?.classList.add('is-ping')

  try {
    const res = await fetch('/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ping',
        potato: villager.name,
        agent_id: villager.id,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      speak('El ping no llegó.', true)
      status.textContent = `Falló ${villager.label}.`
      return
    }
    if (villager.kind === 'scarecrow') {
      speak('El espantapájaros señala. No cosecha.')
      status.textContent = 'Ping local al espantapájaros.'
      return
    }
    if (data.forwarded) {
      speak(`Ping a ${villager.label}. Salió del campo.`)
      status.textContent = `Último ping: ${villager.label}.`
      return
    }
    speak(`Ping local a ${villager.label}. El anfitrión aún no puso el webhook.`)
    status.textContent = `Ping local: ${villager.label}.`
  } catch {
    speak('El ping no llegó.', true)
    status.textContent = `Falló ${villager.label}.`
  } finally {
    window.setTimeout(() => {
      if (activeId === villager.id) {
        activeId = ''
        setHot(villager.id, false)
        hidePlaque()
      }
    }, 700)
  }
}

function render() {
  for (const villager of VILLAGERS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = villager.kind === 'scarecrow' ? 'plant is-scarecrow' : 'plant'
    button.dataset.id = villager.id
    button.style.left = `${villager.x}%`
    button.style.top = `${villager.y}%`
    button.style.width = `${villager.w}%`
    button.style.height = `${villager.h}%`
    button.title = `${villager.name} · ${villager.label}`
    button.setAttribute('aria-label', `${villager.name}, ${villager.label}`)
    button.addEventListener('pointerenter', () => hover(villager, true))
    button.addEventListener('pointerleave', () => hover(villager, false))
    button.addEventListener('focus', () => hover(villager, true))
    button.addEventListener('blur', () => hover(villager, false))
    button.addEventListener('click', () => ping(villager))
    plants.append(button)

    const item = document.createElement('li')
    const row = document.createElement('button')
    row.type = 'button'
    row.dataset.id = villager.id
    row.innerHTML = `<span>${villager.label}</span><span class="en">${villager.name}</span>`
    row.addEventListener('pointerenter', () => hover(villager, true))
    row.addEventListener('pointerleave', () => hover(villager, false))
    row.addEventListener('click', () => ping(villager))
    item.append(row)
    roster.append(item)
  }
}

rosterToggle.addEventListener('click', () => {
  const shut = rosterWrap.classList.toggle('is-shut')
  rosterToggle.setAttribute('aria-expanded', String(!shut))
})

render()

fetch('/health')
  .then((res) => res.json())
  .then((data) => {
    if (data.webhook) status.textContent = 'El campo está quieto. Webhook listo.'
  })
  .catch(() => {})
