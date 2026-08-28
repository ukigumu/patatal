import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideDispatch, parseClick, webhookConfigured } from './click.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(ROOT, 'public')
const PORT = Number.parseInt(process.env.PORT || '3847', 10)
const WEBHOOK_URL = process.env.WEBHOOK_URL || ''
const WEBHOOK_KEY = process.env.WEBHOOK_KEY || ''
const ENV_READY = webhookConfigured(WEBHOOK_URL, WEBHOOK_KEY)
const FAIL_LOG = path.join(ROOT, 'click-fail.log')

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

function sendJson(res, status, payload) {
  send(res, status, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(payload))
}

function safePublicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const rel = decoded === '/' ? '/index.html' : decoded
  const abs = path.normalize(path.join(PUBLIC, rel))
  if (!abs.startsWith(PUBLIC + path.sep) && abs !== PUBLIC) return null
  return abs
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  return JSON.parse(text)
}

function appendFailLog(payload) {
  const line = `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`
  fs.appendFileSync(FAIL_LOG, line)
}

async function forwardWebhook(payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WEBHOOK_KEY}`,
        'X-Automation-Key': WEBHOOK_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    return { ok: res.ok, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}

async function handleClick(req, res) {
  let raw
  try {
    raw = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { ok: false, error: 'json' })
    return
  }
  const parsed = parseClick(raw)
  if (!parsed.ok) {
    sendJson(res, 400, { ok: false, error: parsed.error })
    return
  }
  const payload = {
    action: parsed.action,
    potato: parsed.villager.name,
    agent_id: parsed.villager.id,
  }
  const dest = decideDispatch(parsed.villager, ENV_READY)
  if (dest === 'local') {
    sendJson(res, 200, {
      ok: true,
      forwarded: false,
      local: true,
      potato: parsed.villager.name,
      action: parsed.action,
    })
    return
  }
  try {
    const result = await forwardWebhook(payload)
    if (!result.ok) {
      appendFailLog({ reason: 'webhook_status', status: result.status, payload })
      sendJson(res, 502, { ok: false, error: 'webhook', forwarded: false })
      return
    }
    sendJson(res, 200, {
      ok: true,
      forwarded: true,
      local: false,
      potato: parsed.villager.name,
      action: parsed.action,
    })
  } catch (err) {
    appendFailLog({
      reason: err?.name === 'AbortError' ? 'timeout' : 'webhook_error',
      payload,
    })
    sendJson(res, 502, { ok: false, error: 'webhook', forwarded: false })
  }
}

function handleHealth(res) {
  sendJson(res, 200, { ok: true, webhook: ENV_READY })
}

function handleStatic(req, res) {
  const file = safePublicPath(req.url || '/')
  if (!file) {
    sendJson(res, 404, { ok: false, error: 'not_found' })
    return
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      sendJson(res, 404, { ok: false, error: 'not_found' })
      return
    }
    const ext = path.extname(file)
    send(res, 200, { 'Content-Type': MIME[ext] || 'application/octet-stream' }, data)
  })
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = req.url || '/'
    const method = req.method || 'GET'
    if (method === 'POST' && url.split('?')[0] === '/click') {
      handleClick(req, res)
      return
    }
    if (method === 'GET' && url.split('?')[0] === '/health') {
      handleHealth(res)
      return
    }
    if (method === 'GET') {
      handleStatic(req, res)
      return
    }
    sendJson(res, 405, { ok: false, error: 'method' })
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer()
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Patatal listening on http://0.0.0.0:${PORT}`)
    console.log(ENV_READY ? 'Webhook env is set.' : 'Webhook env is empty. Clicks stay local.')
  })
}
