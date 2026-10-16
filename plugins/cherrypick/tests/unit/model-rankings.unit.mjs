// Cherry Pick beside Ascension and HotOrNot: ratings those plugins set stay
// out of the model, Apply never writes over a ranked record, and Cherry
// Pick's custom-field writes leave theirs alone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDb } from '../../src/js/model/db.js'
import { createEngine } from '../../src/js/model/index.js'
import * as BR from '../../src/js/model/brackets.js'
import {
  placedIds,
  restoreFieldsInput,
} from '../../src/js/model/bracketSetup.js'
import { SCENES } from '../../src/js/data/queries.js'
import { FIELD_PREFIX } from '../../src/js/name.js'
import { syntheticLibrary } from './fixtures/synthetic.mjs'

const { input } = syntheticLibrary()
const copy = () => structuredClone(input)
const close = (a, b, msg) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`)

// What Ascension writes after a few matches
const RANKED = {
  hotornot_stats: JSON.stringify({ total_matches: 5, wins: 3, losses: 2 }),
}
const rankedScene = () => ({
  ...RANKED,
  scene_record: JSON.stringify([{ opponentId: '9', won: true }]),
})
const rankedPerformer = () => ({
  ...RANKED,
  performer_record: JSON.stringify([{ opponentId: '9', won: true }]),
})
// Prime's values for the i-th of n records: 70% / 25% / 5%
const primeValue = (i, n, low = 6, mid = 31) =>
  i < Math.floor(n * 0.7)
    ? low
    : i < Math.floor(n * 0.7) + Math.floor(n * 0.25)
      ? mid
      : 40

const engineFor = (lib, input = {}) => createEngine(buildDb(lib)).compute(input)

// Every prediction and performer affinity of two engines match
function sameModel(a, b, what) {
  assert.equal(a.fits.rated.length, b.fits.rated.length, `${what}: targets`)
  close(a.userMean, b.userMean, `${what}: your average`)
  for (const id of a.db.scenes.keys())
    close(a.prediction(id).value, b.prediction(id).value, `${what}: ${id}`)
  for (const p of a.db.localPerformers)
    close(
      a.performerAffinity(p.id),
      b.performerAffinity(p.id),
      `${what}: performer ${p.id}`,
    )
}

test('the library loader reads custom fields on scenes as well as performers', () => {
  assert.match(SCENES, /\bcustom_fields\b/)
})

test('a scene Ascension ranks counts as unrated: no target, no reason', () => {
  const rated = input.scenes.filter((s) => s.rating100 != null).slice(0, 15)
  const ranked = copy()
  const unrated = copy()
  for (const [i, { id }] of rated.entries()) {
    const s = ranked.scenes.find((x) => x.id === id)
    s.rating100 = 30 + ((i * 37) % 70) // its Elo score, whatever it is
    s.custom_fields = rankedScene()
    unrated.scenes.find((x) => x.id === id).rating100 = null
  }
  const Mr = engineFor(ranked)
  const Mu = engineFor(unrated)
  sameModel(Mr, Mu, 'ranked scenes')
  const s = Mr.db.scenes.get(rated[0].id)
  assert.equal(s.local.ratingSource, 'elo')
  assert.equal(Mr.rating(s), null, 'the model reads none')
  assert.equal(Mr.stashRating(s), 30, "Stash's stays on show")
  // Opting in reads them as the user's again
  const Ml = engineFor(ranked, { learnFromRankings: true })
  assert.equal(Ml.fits.rated.length, Mu.fits.rated.length + rated.length)
  assert.equal(Ml.rating(s), 30)
})

test('performer ratings Ascension ranks or primed add no affinity', () => {
  // Five rated by hand, ten ranked, every other one primed. (A 2★ set by
  // hand among primed performers would read as primed: Prime's 40 looks
  // the same.)
  const base = copy()
  for (const p of base.performers) p.rating100 = null
  const hand = base.performers.slice(0, 5)
  hand.forEach((p, i) => (p.rating100 = [100, 80, 20, 90, 60][i]))
  const lib = structuredClone(base)
  const ranked = lib.performers.slice(5, 15)
  ranked.forEach((p, i) => {
    p.rating100 = 20 + i * 8
    p.custom_fields = rankedPerformer()
  })
  const rest = lib.performers.slice(15)
  rest.forEach((p, i) => (p.rating100 = primeValue(i, rest.length)))

  const Mo = engineFor(lib)
  const Mb = engineFor(base)
  sameModel(Mo, Mb, 'ranked and primed performers')
  const local = (id) => Mo.db.performers.get(id).local
  for (const p of ranked) {
    assert.equal(local(p.id).ratingSource, 'elo')
    assert.equal(Mo.performerRating(p.id), null)
    assert.equal(Mo.stashPerformerRating(p.id), p.rating100)
  }
  for (const p of rest) assert.equal(local(p.id).ratingSource, 'primed')
  for (const p of hand) {
    assert.equal(local(p.id).ratingSource, null, 'set by hand')
    assert.equal(Mo.performerRating(p.id), p.rating100)
  }
  // Opting in: the same ratings move affinity again
  const Ml = engineFor(lib, { learnFromRankings: true })
  assert.ok(
    Math.abs(
      Ml.performerAffinity(rest[0].id) - Mb.performerAffinity(rest[0].id),
    ) > 0.5,
    'a primed 0.3★ would have pushed them down',
  )
})

test('primed scenes count as unrated', () => {
  // Ten rated by hand, the rest primed by "Prime Unrated Scenes" (none of
  // the ten on 2★, which would read as Prime's 40)
  const base = copy()
  const keep = new Set(
    base.scenes
      .filter((s) => s.rating100 >= 50)
      .slice(0, 10)
      .map((s) => s.id),
  )
  for (const s of base.scenes) if (!keep.has(s.id)) s.rating100 = null
  const lib = structuredClone(base)
  const others = lib.scenes.filter((s) => !keep.has(s.id))
  others.forEach((s, i) => (s.rating100 = primeValue(i, others.length, 3, 28)))
  const Mp = engineFor(lib)
  sameModel(Mp, engineFor(base), 'primed scenes')
  for (const s of others)
    assert.equal(Mp.db.scenes.get(s.id).local.ratingSource, 'primed')
  for (const id of keep)
    assert.equal(Mp.db.scenes.get(id).local.ratingSource, null)
})

// A 16-performer bracket played out (always the higher seed), and the
// library as Stash has it afterwards
function placedBracket() {
  const M = engineFor(input)
  const ids = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  let b = BR.createBracket(M, {
    kind: 'performer',
    gender: 'FEMALE',
    poolLabel: 'Female',
    size: 16,
    ids,
    now: 7,
  })
  let st = BR.bracketState(b)
  while (st.current) {
    b = BR.pick(b, st.current.a)
    st = BR.bracketState(b)
  }
  return { ...b, result: st.result, finishedAt: '2026-10-01T20:00:00Z' }
}

test('Apply skips a performer Ascension ranks, with the reason, and fills a primed one', () => {
  const done = placedBracket()
  const r = done.result
  const lib = copy()
  for (const p of lib.performers) p.rating100 = null
  const champ = lib.performers.find((p) => p.id === r.champion)
  champ.rating100 = 55
  champ.custom_fields = rankedPerformer()
  // Prime ran over every unrated performer except the finalist (added later)
  const primed = lib.performers.filter(
    (p) => p.id !== r.champion && p.id !== r.finalist,
  )
  primed.forEach((p, i) => (p.rating100 = primeValue(i, primed.length)))
  const M = engineFor(lib)

  for (const includeRated of [false, true]) {
    const rows = BR.ratingProposals(M, done, includeRated)
    const by = new Map(rows.map((x) => [x.id, x]))
    assert.deepEqual(
      by.get(r.champion),
      { id: r.champion, from: 55, to: 100, why: 'Champion', skip: 'ranked' },
      'listed, never written',
    )
    assert.deepEqual(by.get(r.finalist), {
      id: r.finalist,
      from: null,
      to: 90,
      why: 'Finalist',
    })
    for (const id of [...r.semifinalists, ...r.quarterfinalists]) {
      const x = by.get(id)
      assert.equal(x.primed, true, 'a primed rating counts as unrated')
      assert.equal(x.skip, undefined)
      assert.equal(
        x.from,
        lib.performers.find((p) => p.id === id).rating100,
        "Now shows Stash's",
      )
    }
    assert.equal(rows.length, 8)
  }
})

test('Apply re-checks each record right before writing', () => {
  const changes = [
    { id: '1', to: 100 },
    { id: '2', to: 90 },
    { id: '3', to: 80 },
    { id: '4', to: 70 },
  ]
  const current = new Map([
    ['1', { id: '1', rating100: null, custom_fields: {} }],
    // ranked since the preview: its rating is Ascension's now
    ['2', { id: '2', rating100: 61, custom_fields: rankedPerformer() }],
    ['3', { id: '3', rating100: 40, custom_fields: { elo_matches: 3 } }],
    // '4' is gone from Stash
  ])
  assert.deepEqual(BR.writableChanges(changes, current), {
    write: [{ id: '1', to: 100, from: null }],
    ranked: ['2', '3'],
  })
})

test("a bracket's custom-field writes leave Ascension's and HotOrNot's untouched", () => {
  const done = placedBracket()
  const theirs = {
    hotornot_stats: RANKED.hotornot_stats,
    performer_record: rankedPerformer().performer_record,
    elo_matches: 7,
  }
  const current = Object.fromEntries(
    placedIds(done.result).map((id, i) => [
      id,
      { ...theirs, ...(i % 2 ? { [BR.FIELDS.titles]: 1 } : {}) },
    ]),
  )
  const updates = BR.bracketFieldUpdates(current, done)
  assert.equal(Object.keys(updates).length, 8)
  for (const [id, partial] of Object.entries(updates)) {
    for (const k of Object.keys(partial))
      assert.ok(k.startsWith(FIELD_PREFIX), `${k} is Cherry Pick's own`)
    // Stash's `partial` upserts these keys and keeps every other one
    const after = { ...current[id], ...partial }
    for (const [k, v] of Object.entries(theirs)) assert.equal(after[k], v, k)
    // Undo of the final pick puts back only Cherry Pick's keys
    const prev = Object.fromEntries(
      Object.keys(partial).map((k) => [k, current[id][k] ?? null]),
    )
    const undo = restoreFieldsInput(prev)
    assert.equal(undo.full, undefined)
    for (const k of [
      ...Object.keys(undo.partial || {}),
      ...(undo.remove || []),
    ])
      assert.ok(k.startsWith(FIELD_PREFIX), `undo touches ${k}`)
    // Remove Cherry Pick data takes only Cherry Pick's
    const gone = BR.ownFieldsOn(after)
    assert.ok(gone.length && gone.every((k) => k.startsWith(FIELD_PREFIX)))
    for (const k of Object.keys(theirs)) assert.ok(!gone.includes(k))
  }
  assert.deepEqual(BR.ownFieldsOn(theirs), [])
})

test('no custom-field write replaces the whole map', async () => {
  // `full` would drop every other plugin's fields; only partial and remove
  // are allowed
  const root = new URL('../../src/js/', import.meta.url).pathname
  const files = (await readdir(root, { recursive: true })).filter((f) =>
    /\.jsx?$/.test(f),
  )
  let writes = 0
  for (const f of files) {
    const src = await readFile(join(root, f), 'utf8')
    for (const m of src.matchAll(/custom_fields:\s*([^\n]{0,60})/g)) {
      writes++
      assert.doesNotMatch(m[1], /\bfull\b/, `${f}: ${m[0]}`)
    }
  }
  assert.ok(writes >= 3, 'found the writes')
})
