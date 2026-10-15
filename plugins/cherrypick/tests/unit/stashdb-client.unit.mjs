import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CACHE_PREFIX,
  createStashdbClient,
  GAP_MS,
  TTL_MS,
} from '../../src/js/stashdb/client.js'

// A clock that only moves when the client waits, a cache in a Map, and a
// fetch that records each request and answers from `reply`.
function rig({ reply, ...opts } = {}) {
  let t = 1_000_000
  const calls = []
  const store = new Map()
  const answer =
    reply || (() => ({ status: 200, body: { data: { n: calls.length } } }))
  const client = createStashdbClient({
    endpoint: 'https://stashdb.org/graphql',
    apiKey: 'key-1',
    now: () => t,
    wait: async (ms) => {
      t += ms
    },
    cache: {
      get: async (k) => store.get(k),
      set: async (k, v) => void store.set(k, v),
    },
    fetch: async (url, init) => {
      calls.push({ url, init, at: t })
      const r = await answer(calls.length, init)
      if (r instanceof Error) throw r
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        headers: new Map(Object.entries(r.headers || {})),
        json: async () => r.body,
      }
    },
    ...opts,
  })
  return {
    client,
    calls,
    store,
    advance: (ms) => (t += ms),
    now: () => t,
  }
}

test('requests go one at a time, at least a second apart, with the key', async () => {
  const { client, calls } = rig()
  const answers = await Promise.all([
    client.request('query A { a }', { x: 1 }),
    client.request('query B { b }', {}),
    client.request('query C { c }', {}),
  ])
  assert.deepEqual(
    answers.map((a) => a.n),
    [1, 2, 3],
  )
  for (let i = 1; i < calls.length; i++)
    assert.ok(calls[i].at - calls[i - 1].at >= GAP_MS, `gap before ${i}`)
  const { init, url } = calls[0]
  assert.equal(url, 'https://stashdb.org/graphql')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.ApiKey, 'key-1')
  assert.equal(init.redirect, 'error')
  assert.equal(init.credentials, 'omit')
  assert.equal(init.referrerPolicy, 'no-referrer')
  assert.deepEqual(JSON.parse(init.body), {
    query: 'query A { a }',
    variables: { x: 1 },
  })
})

test('a page view gets a few requests; the next view starts again', async () => {
  const { client, calls } = rig({ perView: 2 })
  const first = await Promise.all([1, 2, 3].map(() => client.request('q', {})))
  assert.equal(calls.length, 2)
  assert.equal(first[2], null, 'the third is skipped, not sent')
  client.newView()
  assert.ok(await client.request('q', {}))
  assert.equal(calls.length, 3)
})

test('requests queued for a page the user left are dropped', async () => {
  const { client, calls } = rig()
  const a = client.request('q', {})
  const b = client.request('q', {})
  client.newView()
  assert.equal(await a, null)
  assert.equal(await b, null)
  assert.equal(calls.length, 0)
})

test('a failure gives null, never an error, and rests the client', async () => {
  const { client, calls, advance } = rig({
    reply: (n) =>
      n === 1 ? new Error('offline') : { status: 200, body: { data: {} } },
  })
  assert.equal(await client.request('q', {}), null)
  assert.equal(await client.request('q', {}), null, 'resting: not sent')
  assert.equal(calls.length, 1)
  advance(61_000)
  client.newView()
  assert.deepEqual(await client.request('q', {}), {})
  assert.equal(calls.length, 2)
})

test('a 429 rests the client for at least ten minutes', async () => {
  const { client, calls, advance } = rig({
    reply: (n) =>
      n === 1
        ? { status: 429, headers: { 'Retry-After': '30' }, body: {} }
        : { status: 200, body: { data: {} } },
  })
  assert.equal(await client.request('q', {}), null)
  advance(9 * 60_000)
  client.newView()
  assert.equal(await client.request('q', {}), null)
  advance(2 * 60_000)
  client.newView()
  assert.deepEqual(await client.request('q', {}), {})
  assert.equal(calls.length, 2)
})

test('a refused key stops lookups for the session', async () => {
  const { client, calls, advance } = rig({
    reply: () => ({
      status: 200,
      body: { errors: [{ message: 'not authorized' }] },
    }),
  })
  assert.equal(await client.request('q', {}), null)
  advance(24 * 3600_000)
  client.newView()
  assert.equal(await client.request('q', {}), null)
  assert.equal(calls.length, 1)
})

test('lookups are cached for 7 days, keyed by lookup', async () => {
  const { client, calls, store, advance } = rig()
  const load = async () => (await client.request('q', {}))?.n
  const first = await client.cached('performer-scenes:p1', load)
  assert.equal(first.data, 1)
  assert.ok(store.has(CACHE_PREFIX + 'performer-scenes:p1'))
  const again = await client.cached('performer-scenes:p1', load)
  assert.equal(again.data, 1)
  assert.equal(again.at, first.at)
  assert.equal(calls.length, 1, 'the second visit sends nothing')
  // another lookup is its own entry
  await client.cached('performer-scenes:p2', load)
  assert.equal(calls.length, 2)
  advance(TTL_MS + 1)
  client.newView()
  const later = await client.cached('performer-scenes:p1', load)
  assert.equal(later.data, 3, 'older than 7 days: asked again')
  assert.equal(calls.length, 3)
})

test('a failed lookup is not cached; "not on StashDB" is', async () => {
  const { client, calls, store } = rig({
    reply: (n) =>
      n === 1
        ? { status: 500, body: {} }
        : { status: 200, body: { data: { s0: null } } },
    perView: 10,
  })
  const load = async () => {
    const d = await client.request('q', {})
    return d ? d.s0 : undefined
  }
  assert.equal(await client.cached('scene:x', load), null)
  assert.equal(store.size, 0)
  // a fresh client (the server error rested this one)
  const r2 = rig({
    reply: () => ({ status: 200, body: { data: { s0: null } } }),
  })
  const load2 = async () => {
    const d = await r2.client.request('q', {})
    return d ? d.s0 : undefined
  }
  const entry = await r2.client.cached('scene:x', load2)
  assert.deepEqual(entry.data, null)
  assert.ok(r2.store.has(CACHE_PREFIX + 'scene:x'))
  await r2.client.cached('scene:x', load2)
  assert.equal(r2.calls.length, 1)
  assert.equal(calls.length, 1)
})

test('two asks for one lookup share one request', async () => {
  const { client, calls } = rig()
  const load = async () => (await client.request('q', {}))?.n
  const [a, b] = await Promise.all([
    client.cached('studio-scenes:s1', load),
    client.cached('studio-scenes:s1', load),
  ])
  assert.equal(calls.length, 1)
  assert.equal(a, b)
})
