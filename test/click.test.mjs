import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { decideDispatch, parseClick, webhookConfigured } from '../click.mjs'
import { byId, VILLAGERS } from '../public/villagers.js'

const scarecrow = byId.get('83677433-ce5e-402b-b748-12f5c0903075')
const developer = byId.get('99c531ae-744a-4306-b680-e9d4b1263825')

assert.equal(VILLAGERS.length, 15)
assert.equal(scarecrow.kind, 'scarecrow')
assert.equal(developer.name, 'Developer')

assert.deepEqual(parseClick(null), { ok: false, error: 'body' })
assert.equal(parseClick({ action: 'wave', potato: developer.name, agent_id: developer.id }).ok, false)
assert.equal(
  parseClick({ action: 'ping', potato: 'Nope', agent_id: developer.id }).error,
  'potato',
)
assert.equal(
  parseClick({ action: 'ping', potato: developer.name, agent_id: 'missing' }).error,
  'unknown',
)

const ping = parseClick({
  action: 'ping',
  potato: developer.name,
  agent_id: developer.id,
})
assert.equal(ping.ok, true)
assert.equal(ping.villager.name, 'Developer')

assert.equal(decideDispatch(scarecrow, true), 'local')
assert.equal(decideDispatch(scarecrow, false), 'local')
assert.equal(decideDispatch(developer, false), 'local')
assert.equal(decideDispatch(developer, true), 'forward')
assert.equal(webhookConfigured('', 'x'), false)
assert.equal(webhookConfigured('https://example.invalid', ''), false)
assert.equal(webhookConfigured('https://example.invalid', 'k'), true)

const received = []
const fakeHook = createHttpServer((req, res) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    received.push({
      auth: req.headers.authorization,
      automation: req.headers['x-automation-key'],
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    })
    res.writeHead(200)
    res.end('ok')
  })
})
fakeHook.listen(0, '127.0.0.1')
await once(fakeHook, 'listening')
const hookPort = fakeHook.address().port

process.env.WEBHOOK_URL = `http://127.0.0.1:${hookPort}/wake`
process.env.WEBHOOK_KEY = 'test-key-not-real'
process.env.PORT = '0'

const { createServer } = await import('../server.mjs')
const farm = createServer()
farm.listen(0, '127.0.0.1')
await once(farm, 'listening')
const farmPort = farm.address().port
const origin = `http://127.0.0.1:${farmPort}`

async function postClick(body) {
  const res = await fetch(`${origin}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

const localScarecrow = await postClick({
  action: 'ping',
  potato: scarecrow.name,
  agent_id: scarecrow.id,
})
assert.equal(localScarecrow.status, 200)
assert.equal(localScarecrow.data.local, true)
assert.equal(localScarecrow.data.forwarded, false)
assert.equal(received.length, 0)

const potatoPing = await postClick({
  action: 'ping',
  potato: developer.name,
  agent_id: developer.id,
})
assert.equal(potatoPing.status, 200)
assert.equal(potatoPing.data.forwarded, true)
assert.equal(received.length, 1)
assert.equal(received[0].auth, 'Bearer test-key-not-real')
assert.equal(received[0].automation, 'test-key-not-real')
assert.deepEqual(received[0].body, {
  action: 'ping',
  potato: 'Developer',
  agent_id: developer.id,
})

const probe = await postClick({
  action: 'probe',
  potato: developer.name,
  agent_id: developer.id,
})
assert.equal(probe.status, 200)
assert.equal(received[1].body.action, 'probe')

const health = await fetch(`${origin}/health`).then((res) => res.json())
assert.equal(health.ok, true)
assert.equal(health.webhook, true)
assert.equal('url' in health, false)
assert.equal('key' in health, false)

const index = await fetch(`${origin}/`)
assert.equal(index.status, 200)
const html = await index.text()
assert.match(html, /Patatal/)
assert.doesNotMatch(html, /test-key-not-real/)
assert.doesNotMatch(html, /WEBHOOK_KEY/)
assert.doesNotMatch(html, /api2\.cursor\.sh/)

const farmJs = await fetch(`${origin}/farm.js`).then((res) => res.text())
assert.doesNotMatch(farmJs, /Authorization/)
assert.doesNotMatch(farmJs, /X-Automation-Key/)
assert.match(farmJs, /fetch\('\/click'/)

farm.close()
fakeHook.close()
console.log('click tests ok')
