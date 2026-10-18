import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDb } from '../../src/js/model/db.js'
import { createEngine } from '../../src/js/model/index.js'
import * as FY from '../../src/js/model/foryou.js'
import { playable, watchOrder } from '../../src/js/model/watch.js'
import { syntheticLibrary } from './fixtures/synthetic.mjs'

const STATE = {
  dontLearn: [],
  notInterested: [],
  settings: { excludedTags: '' },
}
const { input } = syntheticLibrary()

function setUp(scenes = input.scenes, state = STATE) {
  const db = buildDb({ ...input, scenes })
  const M = createEngine(db).compute({})
  return { db, M, ctx: FY.context(M, state) }
}
const ids = (list) => list.map((it) => it.scene.id)

// The first file as Stash reports an audio-only one, or no file at all
const audioOnly = (s) => ({
  ...s,
  files: [{ ...s.files[0], video_codec: '', width: 0, height: 0 }],
})
const noFile = (s) => ({ ...s, files: [] })
const withVideo = (s) => ({
  ...s,
  files: [{ ...s.files[0], video_codec: 'h264', width: 1920, height: 1080 }],
})

test("Watch This plays For you's first card, with its reason", () => {
  const { ctx } = setUp()
  const fy = FY.computeForYou(ctx, FY.EMPTY_SIGNALS)
  const order = watchOrder(ctx, FY.EMPTY_SIGNALS)
  assert.equal(fy[0].kind, 'main')
  assert.equal(order[0].scene.id, fy[0].scene.id)
  assert.equal(order[0].reason(), fy[0].reason)
})

test("the order is For you's score before variety and exploration, every scene with video", () => {
  const { ctx } = setUp()
  const ranked = FY.rankedScenes(ctx, FY.EMPTY_SIGNALS, playable)
  for (let i = 1; i < ranked.length; i++)
    assert.ok(ranked[i - 1].base >= ranked[i].base, 'highest first')
  const order = watchOrder(ctx, FY.EMPTY_SIGNALS)
  assert.deepEqual(
    ids(order),
    ranked.map((x) => x.scene.id),
  )
  assert.equal(order.length, ctx.db.owned.length)
  // no cap per performer: For you's row takes two of a performer at most,
  // the order takes them as they score
  const fyIds = new Set(ids(FY.computeForYou(ctx, FY.EMPTY_SIGNALS)))
  assert.ok(ids(order.slice(0, 12)).some((id) => !fyIds.has(id)))
  for (const it of order.slice(0, 20)) assert.match(it.reason(), /^[A-Z].{8,}/)
})

test('audio-only files and scenes with no file stay out', () => {
  const scenes = input.scenes.map((s, i) =>
    i % 3 === 0 ? audioOnly(s) : i % 3 === 1 ? noFile(s) : withVideo(s),
  )
  const { ctx, db } = setUp(scenes)
  const order = watchOrder(ctx, FY.EMPTY_SIGNALS)
  assert.equal(order.length, scenes.length - Math.ceil(scenes.length * (2 / 3)))
  for (const it of order) {
    assert.equal(it.scene.hasVideo, true)
    assert.notEqual(it.scene.audioOnly, true)
  }
  assert.equal(db.owned.filter((s) => s.audioOnly).length, 40)
})

test('Not interested and the tags kept out of picks stay out', () => {
  const { ctx } = setUp()
  const first = watchOrder(ctx, FY.EMPTY_SIGNALS)[0].scene
  const tag = first.tags[0]
  const state = {
    ...STATE,
    notInterested: [{ sceneId: first.id, key: null }],
    settings: { excludedTags: tag.name },
  }
  const { ctx: kept } = setUp(input.scenes, state)
  const order = watchOrder(kept, FY.EMPTY_SIGNALS)
  assert.ok(order.length > 0)
  for (const it of order) {
    assert.notEqual(it.scene.id, first.id)
    assert.ok(!it.scene.tags.some((t) => t.id === tag.id))
  }
})

test('a library under 30 scenes plays the newest scene with video, as New in your library would', () => {
  const small = syntheticLibrary({ scenes: 29 }).input
  const scenes = small.scenes.map((s, i) => (i % 4 === 0 ? audioOnly(s) : s))
  const db = buildDb({ ...small, scenes })
  const M = createEngine(db).compute({})
  const ctx = FY.context(M, STATE)
  assert.equal(FY.tooSmall(db), true)
  const order = watchOrder(ctx, FY.EMPTY_SIGNALS)
  const row = FY.newInLibrary(ctx).filter((it) => playable(it.scene))
  assert.equal(order[0].scene.id, row[0].scene.id)
  assert.equal(order[0].reason(), row[0].reason)
  // every scene with video, the ones New in your library leaves out last
  assert.equal(order.length, db.owned.filter(playable).length)
  assert.equal(new Set(ids(order)).size, order.length)

  // rated under 3 stars or played this fortnight: still the newest plays
  const disliked = scenes.map((s) => ({ ...s, rating100: 20 }))
  const dbd = buildDb({ ...small, scenes: disliked })
  const ctxd = FY.context(createEngine(dbd).compute({}), STATE)
  assert.equal(FY.newInLibrary(ctxd).length, 0)
  const newest = dbd.owned
    .filter(playable)
    .sort((a, b) => b.local.created_at.localeCompare(a.local.created_at))[0]
  const first = watchOrder(ctxd, FY.EMPTY_SIGNALS)[0]
  assert.equal(first.scene.id, newest.id)
  assert.match(first.reason(), /^Added /)
})

test('a library with no scene that has video has nothing to play', () => {
  const { ctx } = setUp(input.scenes.map(audioOnly))
  assert.deepEqual(watchOrder(ctx, FY.EMPTY_SIGNALS), [])
  const small = syntheticLibrary({ scenes: 20 }).input
  const db = buildDb({ ...small, scenes: small.scenes.map(noFile) })
  const ctxs = FY.context(createEngine(db).compute({}), STATE)
  assert.deepEqual(watchOrder(ctxs, FY.EMPTY_SIGNALS), [])
})
