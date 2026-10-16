import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLibrary, REFRESH_MS } from '../../src/js/data/library.js'

// A fake Stash with n scenes and two performers that answers the library's
// queries, counting requests.
function fakeStash(n) {
  const scenes = Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    title: `Scene ${i + 1}`,
    updated_at: '2026-01-01T00:00:00Z',
    last_played_at: null,
  }))
  const performers = [{ id: '1' }, { id: '2' }]
  const calls = []
  const run = async (query, vars) => {
    calls.push(vars)
    const list = query.includes('findScenes') ? scenes : performers
    const field = query.includes('findScenes') ? 'findScenes' : 'findPerformers'
    const key = field === 'findScenes' ? 'scenes' : 'performers'
    let rows = list
    const since = vars.scene_filter?.updated_at?.value
    if (since)
      rows = list.filter(
        (s) =>
          s.updated_at > since ||
          (s.last_played_at && s.last_played_at > since),
      )
    const { per_page, page = 1 } = vars.filter
    const pageRows = per_page
      ? rows.slice((page - 1) * per_page, page * per_page)
      : []
    return { [field]: { count: rows.length, [key]: pageRows } }
  }
  return { scenes, run, calls }
}

const memCache = () => {
  const m = new Map()
  return { get: async (k) => m.get(k), set: async (k, v) => m.set(k, v) }
}

test('loads every page of scenes and performers', async () => {
  const stash = fakeStash(1234)
  const lib = await loadLibrary({ run: stash.run, cache: memCache() })
  assert.equal(lib.scenes.length, 1234)
  assert.equal(lib.performers.length, 2)
  assert.equal(lib.fromCache, false)
})

test('a fresh copy comes from the cache with no requests', async () => {
  const stash = fakeStash(10)
  const cache = memCache()
  const now = Date.parse('2026-02-01T00:00:00Z')
  await loadLibrary({ run: stash.run, cache, now })
  stash.calls.length = 0
  const lib = await loadLibrary({ run: stash.run, cache, now: now + 1000 })
  assert.equal(lib.fromCache, true)
  assert.equal(stash.calls.length, 0)
})

test('an older copy fetches only what changed', async () => {
  const stash = fakeStash(10)
  const cache = memCache()
  const now = Date.parse('2026-02-01T00:00:00Z')
  await loadLibrary({ run: stash.run, cache, now })
  stash.scenes[3] = {
    ...stash.scenes[3],
    title: 'Renamed',
    last_played_at: '2026-02-01T00:01:00Z',
  }
  const lib = await loadLibrary({
    run: stash.run,
    cache,
    now: now + REFRESH_MS + 1000,
  })
  assert.equal(lib.fromCache, false)
  assert.equal(lib.scenes.find((s) => s.id === '4').title, 'Renamed')
  assert.equal(lib.scenes.length, 10)
})

test('a deleted scene triggers a full reload', async () => {
  const stash = fakeStash(10)
  const cache = memCache()
  const now = Date.parse('2026-02-01T00:00:00Z')
  await loadLibrary({ run: stash.run, cache, now })
  stash.scenes.pop()
  const lib = await loadLibrary({
    run: stash.run,
    cache,
    now: now + REFRESH_MS + 1000,
  })
  assert.equal(lib.scenes.length, 9)
})

test('a copy saved before scenes carried custom fields is read again in full', async () => {
  const stash = fakeStash(10)
  const now = Date.parse('2026-02-01T00:00:00Z')
  const cache = memCache()
  await cache.set('library', {
    version: 1,
    syncedAt: new Date(now).toISOString(),
    scenes: stash.scenes.slice(0, 3),
    performers: [],
  })
  const lib = await loadLibrary({ run: stash.run, cache, now: now + 1000 })
  assert.equal(lib.fromCache, false)
  assert.equal(lib.scenes.length, 10)
})
