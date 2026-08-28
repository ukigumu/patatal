import { byId } from './public/villagers.js'

const ACTIONS = new Set(['ping', 'probe'])

export function parseClick(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'body' }
  }
  const action = raw.action
  if (typeof action !== 'string' || !ACTIONS.has(action)) {
    return { ok: false, error: 'action' }
  }
  if (typeof raw.agent_id !== 'string' || typeof raw.potato !== 'string') {
    return { ok: false, error: 'fields' }
  }
  const villager = byId.get(raw.agent_id)
  if (!villager) {
    return { ok: false, error: 'unknown' }
  }
  if (raw.potato !== villager.name) {
    return { ok: false, error: 'potato' }
  }
  return { ok: true, action, villager }
}

export function decideDispatch(villager, envConfigured) {
  if (villager.kind === 'scarecrow') return 'local'
  if (!envConfigured) return 'local'
  return 'forward'
}

export function webhookConfigured(url, key) {
  return Boolean(url) && Boolean(key)
}
