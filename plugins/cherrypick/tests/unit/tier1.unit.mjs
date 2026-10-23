import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createTier1,
  fromConfig,
  toConfig,
} from '../../src/js/storage/tier1.js'
import {
  autoApplyToWrite,
  SETTING_DEFAULTS,
} from '../../src/js/storage/settings.js'

// A fake Stash (one plugin map), a fake browser mirror and a clock. A
// promise in server.hold.read or .write holds that request back until it
// settles, and one in server.hold.settle holds every write until the page
// settles; server.cutOff loses a write's answer after Stash took it, as when
// the page is left while it is out.
function rig({ settingsOpen = false } = {}) {
  const server = { map: null, reads: 0, writes: 0, hold: {}, cutOff: false }
  const box = { mirror: null }
  let t = 0
  const open = { value: settingsOpen }
  const tier1 = createTier1({
    read: async () => {
      server.reads++
      await server.hold.read
      return server.map ? structuredClone(server.map) : null
    },
    write: async (map) => {
      await server.hold.write
      server.map = structuredClone(map)
      server.writes++
      if (server.cutOff) throw new Error('the page was left')
    },
    mirror: {
      get: () => box.mirror,
      set: (m) => (box.mirror = structuredClone(m)),
      del: () => (box.mirror = null),
    },
    settingsOpen: () => open.value,
    settle: async () => {
      await server.hold.settle
    },
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, t++)).toISOString(),
  })
  return { server, box, open, tier1 }
}

const state = (patch = {}) => ({
  ...fromConfig(null),
  ...patch,
})

// A request held back, and the function that lets it go
function held() {
  let release
  const promise = new Promise((r) => (release = r))
  return { promise, release }
}

test('a missing map reads as the defaults', () => {
  const s = fromConfig(null)
  assert.deepEqual(s.settings, SETTING_DEFAULTS)
  assert.deepEqual(s.notInterested, [])
  assert.equal(s.brackets.active, null)
})

test('toConfig and fromConfig round-trip', () => {
  const s = state({
    notInterested: [{ sceneId: '4' }],
    brackets: { active: { id: 'b1' }, history: [{ id: 'b0' }] },
    mapSize: 'short',
  })
  assert.deepEqual(fromConfig(toConfig(s)), s)
})

test('writes are read-modify-write and keep keys the plugin did not change', async () => {
  const { server, tier1 } = rig()
  server.map = { showForYou: false, somethingElse: 1 }
  await tier1.save(toConfig(state({ dontLearn: [{ sceneId: '9' }] })), [
    'dontLearn',
  ])
  assert.equal(server.map.showForYou, false)
  assert.equal(server.map.somethingElse, 1)
  assert.equal(server.map.dontLearn, JSON.stringify([{ sceneId: '9' }]))
  assert.ok(server.map.updatedAt)
})

test('data keys are JSON text, so numbers in arrays survive a Stash restart', () => {
  const s = state({
    brackets: { active: null, history: [{ id: 'b1', size: 16, seeds: ['3'] }] },
  })
  const map = toConfig(s)
  assert.equal(typeof map.hallOfFame, 'string')
  assert.equal(fromConfig(map).brackets.history[0].size, 16)
  // An older map that holds the value itself still reads.
  assert.deepEqual(fromConfig({ dontLearn: [{ sceneId: '1' }] }).dontLearn, [
    { sceneId: '1' },
  ])
})

test("writes wait while Stash's Settings page is open, then land on top", async () => {
  const { server, open, tier1 } = rig({ settingsOpen: true })
  server.map = { updatedAt: '2025-12-31T00:00:00.000Z' }
  const full = toConfig(state({ dontLearn: [{ sceneId: '1' }] }))
  assert.equal(await tier1.save(full, ['dontLearn']), 'deferred')
  assert.equal(server.writes, 0)
  assert.deepEqual(tier1.pending(), ['dontLearn'])
  // The Settings page writes back its stale copy with a toggle.
  server.map = { updatedAt: server.map.updatedAt, badges: false }
  open.value = false
  await tier1.flush()
  assert.equal(server.map.badges, false)
  assert.deepEqual(fromConfig(server.map).dontLearn, [{ sceneId: '1' }])
  assert.deepEqual(tier1.pending(), [])
})

test("a deferred write never undoes a switch turned on Stash's Settings page", async () => {
  const { server, open, tier1 } = rig({ settingsOpen: true })
  server.map = { updatedAt: '2025-12-31T00:00:00.000Z', medals: true }
  // The plugin's copy, still with medals on, writing every key (a restore).
  const full = toConfig(state({ dontLearn: [{ sceneId: '1' }] }))
  assert.equal(full.medals, true)
  await tier1.save(full, Object.keys(full))
  // The user turns medals off; Stash writes its copy.
  server.map = { ...server.map, medals: false }
  open.value = false
  await tier1.flush()
  assert.equal(server.map.medals, false)
  assert.equal(server.map.showForYou, true, 'a missing setting is filled in')
  assert.deepEqual(fromConfig(server.map).dontLearn, [{ sceneId: '1' }])
})

test('Brackets starts on, and off keeps the paused bracket and the Hall of Fame through writes', async () => {
  assert.equal(fromConfig(null).settings.brackets, true)
  const { server, tier1 } = rig()
  const paused = {
    id: 'b1',
    status: 'paused',
    decisions: [{ winner: '3', loser: '4' }],
  }
  const history = [{ id: 'b0', result: { champion: '5' } }]
  // Stash's Settings page turned the switch off
  server.map = {
    ...toConfig(state({ brackets: { active: paused, history } })),
    brackets: false,
  }
  const { map } = await tier1.load()
  const s = fromConfig(map)
  assert.equal(s.settings.brackets, false)
  assert.deepEqual(s.brackets, { active: paused, history })
  // the plugin writes something else, from a copy that still has it on
  const copy = {
    ...s,
    settings: { ...s.settings, brackets: true },
    dontLearn: [{ sceneId: '8' }],
  }
  await tier1.save(toConfig(copy), ['dontLearn'])
  assert.equal(server.map.brackets, false)
  assert.deepEqual(fromConfig(server.map).brackets, { active: paused, history })
})

test('a missing map is restored from the mirror', async () => {
  const { server, box, tier1 } = rig()
  await tier1.save(toConfig(state({ notInterested: [{ sceneId: '2' }] })), [
    'notInterested',
  ])
  server.map = null
  const { map, restored } = await tier1.load()
  assert.equal(restored, 'missing')
  assert.deepEqual(fromConfig(map).notInterested, [{ sceneId: '2' }])
  assert.ok(box.mirror)
})

test("a stale map gets the plugin's data back and keeps Stash's settings", async () => {
  const { server, tier1 } = rig()
  await tier1.save(toConfig(state({ dontLearn: [{ sceneId: '3' }] })), [
    'dontLearn',
  ])
  // Stash's Settings page wrote an older copy with a toggle changed.
  server.map = { updatedAt: '2025-01-01T00:00:00.000Z', medals: false }
  const { map, restored } = await tier1.load()
  assert.equal(restored, 'stale')
  assert.equal(map.medals, false)
  assert.deepEqual(fromConfig(map).dontLearn, [{ sceneId: '3' }])
})

test('a write after a stale copy writes back every data key', async () => {
  const { server, tier1 } = rig()
  await tier1.save(toConfig(state({ dontLearn: [{ sceneId: '3' }] })), [
    'dontLearn',
  ])
  server.map = { updatedAt: '2025-01-01T00:00:00.000Z' }
  await tier1.save(toConfig(state({ dontLearn: [{ sceneId: '3' }] })), [
    'consent',
  ])
  assert.deepEqual(fromConfig(server.map).dontLearn, [{ sceneId: '3' }])
})

test("removal leaves a tombstone that other browsers' mirrors respect", async () => {
  const a = rig()
  await a.tier1.save(toConfig(state({ dontLearn: [{ sceneId: '5' }] })), [
    'dontLearn',
  ])
  const otherMirror = structuredClone(a.box.mirror)
  await a.tier1.remove()
  assert.ok(a.server.map.removedAt)
  assert.equal(a.box.mirror, null)
  // Another browser still holds a mirror from before the removal.
  a.box.mirror = otherMirror
  const { map, restored } = await a.tier1.load()
  assert.deepEqual(fromConfig(map).dontLearn, [])
  assert.equal(restored, null)
  assert.equal(a.box.mirror, null)
})

test('a staged change reaches the mirror at once and is restored at the next load', async () => {
  const { server, box, tier1 } = rig()
  await tier1.save(toConfig(state()), ['dontLearn'])
  tier1.stage(toConfig(state({ dontLearn: [{ sceneId: '8' }] })), ['dontLearn'])
  assert.deepEqual(fromConfig(box.mirror).dontLearn, [{ sceneId: '8' }])
  // The tab closed before the save: Stash's map is older than the mirror.
  const { map, restored } = await tier1.load()
  assert.equal(restored, 'stale')
  assert.deepEqual(fromConfig(map).dontLearn, [{ sceneId: '8' }])
  assert.deepEqual(fromConfig(server.map).dontLearn, [])
})

// A bracket is started and saved, then abandoned while that save is out,
// and the page is left before the abandon's own save.
const started = toConfig(
  state({ brackets: { active: { id: 'b1' }, history: [] } }),
)
const abandoned = toConfig(state())

test('a change staged while a save is out stays in the mirror, and the next load restores it', async () => {
  const { server, box, tier1 } = rig()
  tier1.stage(started, ['bracket'])
  const write = held()
  server.hold.write = write.promise
  const saving = tier1.save(started, ['bracket'])
  tier1.stage(abandoned, ['bracket'])
  write.release()
  await saving
  assert.deepEqual(fromConfig(server.map).brackets.active, { id: 'b1' })
  assert.equal(fromConfig(box.mirror).brackets.active, null)
  const { map, restored } = await tier1.load()
  assert.equal(restored, 'stale')
  assert.equal(fromConfig(map).brackets.active, null)
})

test('a save that reaches Stash after the page was left is older than a change staged after it took its copy', async () => {
  const { server, tier1 } = rig()
  tier1.stage(started, ['bracket'])
  const read = held()
  server.hold.read = read.promise
  server.cutOff = true
  const saving = tier1.save(started, ['bracket'])
  tier1.stage(abandoned, ['bracket'])
  read.release()
  await assert.rejects(saving)
  assert.deepEqual(fromConfig(server.map).brackets.active, { id: 'b1' })
  const { map, restored } = await tier1.load()
  assert.equal(restored, 'stale')
  assert.equal(fromConfig(map).brackets.active, null)
})

test('the first write after a removal keeps the tombstone', async () => {
  const a = rig()
  await a.tier1.save(toConfig(state({ dontLearn: [{ sceneId: '5' }] })), [
    'dontLearn',
  ])
  const otherMirror = structuredClone(a.box.mirror)
  await a.tier1.remove()
  await a.tier1.save(toConfig(state()), ['notInterested'])
  assert.ok(a.server.map.removedAt)
  assert.deepEqual(fromConfig(a.server.map).dontLearn, [])
  a.box.mirror = otherMirror
  const { map } = await a.tier1.load()
  assert.deepEqual(fromConfig(map).dontLearn, [])
  assert.equal(a.box.mirror, null)
})

// Stash 0.30 to 0.31.1 can freeze when a configuration write meets certain
// reads, so tier 1 sends as few writes as it can, each once the page has
// settled (runtime/settle.js).
test('a write that would change nothing is not sent, and the next load does not read the map as stale', async () => {
  const { server, box, tier1 } = rig()
  const s = state({ dontLearn: [{ sceneId: '4' }] })
  await tier1.save(toConfig(s), ['dontLearn'])
  assert.equal(server.writes, 1)
  // the same value staged and saved again, as when a list is rebuilt
  tier1.stage(toConfig(s), ['dontLearn'])
  assert.equal(await tier1.save(toConfig(s), ['dontLearn']), 'unchanged')
  assert.equal(server.writes, 1)
  assert.equal(box.mirror.updatedAt, server.map.updatedAt)
  const { restored } = await tier1.load()
  assert.equal(restored, null)
})

test('the defaults on a map that already holds them are not written again', async () => {
  const { server, tier1 } = rig()
  const full = toConfig(state())
  await tier1.save(full, Object.keys(full))
  assert.equal(server.writes, 1)
  await tier1.save(full, Object.keys(full))
  assert.equal(server.writes, 1)
})

test('saves made while a write waits for the page to settle go out with it, as one write', async () => {
  const { server, tier1 } = rig()
  const page = held()
  server.hold.settle = page.promise
  const first = tier1.save(toConfig(state({ dontLearn: [{ sceneId: '1' }] })), [
    'dontLearn',
  ])
  const second = tier1.save(
    toConfig(
      state({
        dontLearn: [{ sceneId: '1' }],
        notInterested: [{ sceneId: '2' }],
      }),
    ),
    ['notInterested'],
  )
  assert.equal(server.reads, 0, 'nothing is sent before the page settles')
  page.release()
  assert.equal(await first, 'written')
  assert.equal(await second, 'written')
  assert.equal(server.reads, 1)
  assert.equal(server.writes, 1)
  const s = fromConfig(server.map)
  assert.deepEqual(s.dontLearn, [{ sceneId: '1' }])
  assert.deepEqual(s.notInterested, [{ sceneId: '2' }])
})

test('a write waiting for the page to settle keeps a change staged while it waits, stamped with its copy', async () => {
  const { server, box, tier1 } = rig()
  const page = held()
  server.hold.settle = page.promise
  tier1.stage(started, ['bracket'])
  const saving = tier1.save(started, ['bracket'])
  tier1.stage(abandoned, ['bracket'])
  const again = tier1.save(abandoned, ['bracket'])
  page.release()
  await saving
  await again
  assert.equal(server.writes, 1)
  assert.equal(fromConfig(server.map).brackets.active, null)
  assert.equal(box.mirror.updatedAt, server.map.updatedAt)
})

test('load takes a map the caller already read and sends no read of its own', async () => {
  const { server, tier1 } = rig()
  const map = toConfig(state({ dontLearn: [{ sceneId: '6' }] }))
  const { map: got, restored } = await tier1.load(map)
  assert.equal(server.reads, 0)
  assert.equal(restored, null)
  assert.deepEqual(fromConfig(got).dontLearn, [{ sceneId: '6' }])
  // null: Stash holds no map, and the mirror the first load kept brings it
  // back
  const none = await tier1.load(null)
  assert.equal(server.reads, 0)
  assert.equal(none.restored, 'missing')
  assert.deepEqual(fromConfig(none.map).dontLearn, [{ sceneId: '6' }])
})

test('removal drops a write still waiting for the page to settle', async () => {
  const { server, tier1 } = rig()
  const page = held()
  server.hold.settle = page.promise
  const saving = tier1.save(
    toConfig(state({ dontLearn: [{ sceneId: '7' }] })),
    ['dontLearn'],
  )
  const removing = tier1.remove()
  page.release()
  assert.equal(await saving, 'none')
  await removing
  assert.equal(server.writes, 1)
  assert.ok(server.map.removedAt)
  assert.deepEqual(fromConfig(server.map).dontLearn, [])
})

test('Apply bracket ratings automatically: on unless another plugin manages ratings, until the user sets it', () => {
  assert.equal(SETTING_DEFAULTS.autoApply, true)
  const w = (value, wrote, managed) =>
    autoApplyToWrite({ value, wrote, managed })
  // first load: the default
  assert.equal(w(undefined, null, false), true)
  assert.equal(w(null, null, true), false, 'Ascension and the like: off')
  // untouched since Cherry Pick wrote it: it follows the plugins
  assert.equal(w(true, true, true), false, 'a ranking plugin turned on since')
  assert.equal(w(false, false, false), true, 'and turned off again')
  assert.equal(w('true', true, true), false, 'a value Stash returns as text')
  assert.equal(w(true, true, false), null, 'nothing to change')
  // the user set it: theirs
  assert.equal(w(false, true, false), null)
  assert.equal(w(true, false, true), null)
  // a map from before the setting's rule was kept: theirs as well
  assert.equal(w(true, null, true), null)
})
