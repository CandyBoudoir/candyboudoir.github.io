import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'
import { createGuard, kindOf } from './config-guard.mjs'

const gql = (query) => JSON.stringify({ query, variables: {} })

test('kindOf tells config writes and the reads that take the lock twice apart', () => {
  // What the Stash UI and the plugins here send
  const cases = [
    ['GET', '/performer/12/image?t=1792758018', '', 'read'],
    ['GET', '/performer/12/image?default=true', '', 'read'],
    ['GET', '/performer/12/image', '', 'read'],
    ['POST', '/graphql', gql('{ configuration { plugins } }'), 'read'],
    [
      'POST',
      '/graphql',
      gql('query Configuration { configuration { ...ConfigData } }'),
      'read',
    ],
    [
      'POST',
      '/graphql',
      gql(
        'mutation ConfigurePlugin($plugin_id: ID!, $input: Map!) {\n  configurePlugin(plugin_id: $plugin_id, input: $input)\n}',
      ),
      'write',
    ],
    [
      'POST',
      '/graphql',
      gql('mutation { configureUI(partial: { lastNoteSeen: 99999999 }) }'),
      'write',
    ],
    [
      'POST',
      '/graphql',
      gql('mutation ($m: BoolMap!) { setPluginsEnabled(enabledMap: $m) }'),
      'write',
    ],
    [
      'POST',
      '/graphql',
      gql('mutation ($i: SetupInput!) { setup(input: $i) }'),
      'write',
    ],
    [
      'POST',
      '/graphql',
      gql('mutation { sceneUpdate(input: {id: 1}) { id } }'),
      null,
    ],
    ['POST', '/graphql', gql('{ findScenes { count } }'), null],
    ['GET', '/studio/3/image', '', null],
    ['GET', '/performer/12', '', null],
    ['GET', '/graphql', '', null],
  ]
  for (const [method, url, body, kind] of cases)
    assert.equal(kindOf(method, url, body), kind, `${method} ${url} ${body}`)
})

// A stand-in Stash that counts every config write that overlaps a read that
// takes Stash's config lock twice: the overlap the deadlock needs
async function standIn({ hold = () => sleep(Math.random() * 3) } = {}) {
  const state = { reads: 0, writing: 0, overlaps: 0, log: [] }
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks).toString()
    const kind = kindOf(req.method, req.url, body)
    state.log.push({
      kind,
      url: req.url,
      host: req.headers.host,
      at: Date.now(),
    })
    if (kind === 'read') {
      state.reads++
      if (state.writing) state.overlaps++
      await hold(kind)
      state.reads--
    } else if (kind === 'write') {
      state.writing++
      if (state.reads) state.overlaps++
      await hold(kind)
      state.writing--
    }
    res.end(req.headers.host)
  })
  server.on('upgrade', (req, socket) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: echo\r\nConnection: Upgrade\r\n\r\n',
    )
    socket.pipe(socket)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { state, server, port: server.address().port }
}

const shut = (...servers) =>
  servers.forEach((s) => (s.closeAllConnections(), s.close()))

async function guarding(port, log) {
  const guard = createGuard({ target: port, log })
  guard.listen(0, '127.0.0.1')
  await once(guard, 'listening')
  return { guard, port: guard.address().port }
}

const read = (port) =>
  fetch(`http://127.0.0.1:${port}/performer/7/image?t=1`).then((r) => r.text())
const write = (port) =>
  fetch(`http://127.0.0.1:${port}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: gql('mutation { configurePlugin(plugin_id: "x", input: {}) }'),
  }).then((r) => r.text())
const configuration = (port) =>
  fetch(`http://127.0.0.1:${port}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: gql('{ configuration { plugins } }'),
  }).then((r) => r.text())

// Six readers and two writers for 400 ms, as a page full of performer
// images and a plugin saving its settings
async function hammer(port) {
  const until = Date.now() + 400
  const loop = async (send) => {
    while (Date.now() < until) await send(port)
  }
  await Promise.all([
    ...Array.from({ length: 3 }, () => loop(read)),
    ...Array.from({ length: 3 }, () => loop(configuration)),
    ...Array.from({ length: 2 }, () => loop(write)),
  ])
}

test('without the guard, config writes overlap the reads', async () => {
  const stash = await standIn()
  try {
    await hammer(stash.port)
    assert.ok(stash.state.overlaps > 0, 'the stand-in saw no overlap')
  } finally {
    shut(stash.server)
  }
})

test('through the guard, no config write overlaps a read', async () => {
  const stash = await standIn()
  const { guard, port } = await guarding(stash.port)
  try {
    await hammer(port)
    const kinds = new Set(stash.state.log.map((e) => e.kind))
    assert.deepEqual([...kinds].sort(), ['read', 'write'])
    assert.equal(stash.state.overlaps, 0)
  } finally {
    shut(guard, stash.server)
  }
})

test('a read the browser gives up on holds writes back until Stash answers it', async () => {
  const stash = await standIn({
    hold: (kind) => sleep(kind === 'read' ? 200 : 0),
  })
  const logged = []
  const { guard, port } = await guarding(stash.port, (l) => logged.push(l))
  try {
    const gaveUp = new AbortController()
    const started = Date.now()
    const abandoned = fetch(`http://127.0.0.1:${port}/performer/7/image`, {
      signal: gaveUp.signal,
    }).catch(() => {})
    await sleep(30)
    gaveUp.abort()
    await abandoned
    await sleep(20)
    await write(port)
    const at = stash.state.log.find((e) => e.kind === 'write').at
    assert.ok(
      at - started >= 190,
      `the write reached Stash after ${at - started} ms`,
    )
    assert.equal(stash.state.overlaps, 0)
    // and the log names the read the write waited for
    assert.match(
      logged.join('\n'),
      /^held a write for 1 read\(s\) in Stash: GET \/performer\/7\/image \(0\.\d s, its client gone\)$/,
    )
  } finally {
    shut(guard, stash.server)
  }
})

test('a read the browser gives up on halfway through its answer leaves when Stash ends it', async () => {
  // Stash sends an image's head and first bytes at once and the rest 200 ms
  // later, and answers a write at once
  const stash = createServer(async (req, res) => {
    for await (const c of req) void c
    if (!req.url.startsWith('/performer/')) return res.end('ok')
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.write('first')
    setTimeout(() => res.end('rest'), 200)
  })
  stash.listen(0, '127.0.0.1')
  await once(stash, 'listening')
  const { guard, port } = await guarding(stash.address().port)
  try {
    const gaveUp = new AbortController()
    const image = await fetch(`http://127.0.0.1:${port}/performer/7/image`, {
      signal: gaveUp.signal,
    })
    await image.body.getReader().read()
    gaveUp.abort()
    const written = await Promise.race([
      write(port).then(() => 'written'),
      sleep(1500).then(() => 'held'),
    ])
    assert.equal(written, 'written')
  } finally {
    shut(guard, stash)
  }
})

test('the guard keeps the Host header and passes websockets through', async () => {
  const stash = await standIn()
  const { guard, port } = await guarding(stash.port)
  try {
    assert.equal(await read(port), `127.0.0.1:${port}`)
    const upgrade = request({
      host: '127.0.0.1',
      port,
      path: '/graphql',
      headers: { Connection: 'Upgrade', Upgrade: 'echo' },
    })
    upgrade.end()
    const [, socket] = await once(upgrade, 'upgrade')
    socket.write('ping')
    const [data] = await once(socket, 'data')
    assert.equal(data.toString(), 'ping')
    socket.destroy()
  } finally {
    shut(guard, stash.server)
  }
})
