import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDb } from '../../src/js/model/db.js'
import { createEngine } from '../../src/js/model/index.js'
import * as BR from '../../src/js/model/brackets.js'
import { FIELD_PREFIX } from '../../src/js/name.js'
import { syntheticLibrary } from './fixtures/synthetic.mjs'

const { input } = syntheticLibrary()
const db = buildDb(input)
const M = createEngine(db).compute({})

// play a bracket out, always picking side a (the higher seed in round one)
function playOut(b) {
  let st = BR.bracketState(b)
  while (st.current) {
    b = BR.pick(b, st.current.a)
    st = BR.bracketState(b)
  }
  return {
    ...b,
    result: st.result,
    finishedAt: '2026-10-01T20:00:00Z',
    status: 'done',
  }
}

test('seeding: 1 v N, so 1 and 2 can only meet in the final', () => {
  assert.deepEqual(BR.seedOrder(2), [1, 2])
  assert.deepEqual(BR.seedOrder(4), [1, 4, 2, 3])
  assert.deepEqual(BR.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6])
  for (const n of [16, 32, 64]) {
    const o = BR.seedOrder(n)
    assert.deepEqual(
      o.slice().sort((a, b) => a - b),
      Array.from({ length: n }, (_, i) => i + 1),
    )
    assert.ok(o.indexOf(1) < n / 2 && o.indexOf(2) >= n / 2)
    for (let i = 0; i < n; i += 2) assert.equal(o[i] + o[i + 1], n + 1)
  }
})

test('sizes: 16 by default, 32 or 64 when picked and the pool fills them', () => {
  assert.equal(BR.DEFAULT_SIZE, 16)
  assert.equal(BR.resolveSize(16, 20), 16)
  assert.equal(BR.resolveSize(32, 20), 16)
  assert.equal(BR.resolveSize(32, 40), 32)
  assert.equal(BR.resolveSize(64, 63), 16)
  assert.equal(BR.resolveSize(64, 64), 64)
  assert.equal(BR.resolveSize(16, 15), null)
  assert.equal(BR.resolveSize(7, 40), 16, 'not a size: the default')
})

test('clip brackets: every scene under 16, with byes for the top seeds', () => {
  assert.deepEqual(
    [3, 4, 5, 7, 8, 9, 11, 15, 16, 60].map((n) => BR.clipSize(n)),
    [null, 4, 8, 8, 8, 16, 16, 16, 16, 16],
  )
  assert.equal(BR.clipSize(40, 32), 32)
  assert.equal(BR.clipSize(20, 32), 16)
  assert.equal(BR.clipSize(9, 32), 16, 'under 16 the size picker has no say')
  assert.deepEqual(
    [3, 4, 5, 7, 8, 11, 15, 16, 30].map(BR.clipByes),
    [0, 0, 3, 1, 0, 5, 1, 0, 0],
  )
  assert.equal(BR.clipPoolPhrase(7), 'the 7')
  assert.equal(BR.clipPoolPhrase(16), 'the 16')
  assert.equal(BR.clipPoolPhrase(60), 'your top 16 of the 60')
})

test('a clip bracket of 7: one bye, then six picks to a champion', () => {
  const ids = BR.watchedScenes(db)
    .slice(0, 7)
    .map((s) => s.id)
  const b = BR.createBracket(M, {
    kind: 'clip',
    poolLabel: 'Seven',
    size: BR.clipSize(7),
    ids,
    now: 5,
  })
  assert.equal(b.size, 8)
  assert.deepEqual(b.seeds.slice().sort(), ids.slice().sort())
  for (let i = 1; i < b.seeds.length; i++)
    assert.ok(
      M.estimate(b.seeds[i - 1]) >= M.estimate(b.seeds[i]),
      'seeded by estimate',
    )
  let st = BR.bracketState(b)
  const first = st.rounds[0]
  assert.equal(first.filter((m) => m.bye).length, 1)
  assert.equal(
    first.find((m) => m.bye).winner,
    b.seeds[0],
    'the top seed gets the bye',
  )
  assert.equal(st.label, 'Quarterfinals · match 1 of 3')
  assert.equal(st.totalMatches, 6)
  const done = playOut(b)
  assert.equal(done.decisions.length, 6)
  st = BR.bracketState(done)
  assert.equal(st.done, true)
  assert.equal(st.label, 'Finished')
  assert.equal(st.result.champion, b.seeds[0])
  assert.equal(st.result.finalist, b.seeds[1])
  assert.equal(st.result.semifinalists.length, 2)
  assert.equal(st.result.quarterfinalists.length, 3, 'the bye leaves three')
})

test('pick and undo', () => {
  const ids = BR.watchedScenes(db)
    .slice(0, 16)
    .map((s) => s.id)
  const b = BR.createBracket(M, {
    kind: 'clip',
    poolLabel: 'All',
    size: 16,
    ids,
    now: 6,
  })
  const st0 = BR.bracketState(b)
  assert.equal(st0.label, 'Round of 16 · match 1 of 8')
  const b1 = BR.pick(b, st0.current.b)
  assert.deepEqual(b1.decisions, [
    { winner: st0.current.b, loser: st0.current.a },
  ])
  assert.equal(BR.bracketState(b1).label, 'Round of 16 · match 2 of 8')
  assert.deepEqual(BR.undo(b1), b)
  assert.deepEqual(BR.bracketState(BR.undo(b1)).current, st0.current)
  assert.equal(BR.undo(b), b, 'nothing to undo')
  const done = playOut(b)
  assert.equal(BR.pick(done, done.seeds[0]), done, 'nothing left to pick')
  assert.deepEqual(BR.modelDecisions(b1), [
    {
      kind: 'clip',
      winner: st0.current.b,
      loser: st0.current.a,
      bracket: b.id,
    },
  ])
})

test('a pick feeds the model and Undo takes it back', () => {
  const ids = BR.watchedScenes(db)
    .slice(0, 8)
    .map((s) => s.id)
  const b = BR.createBracket(M, {
    kind: 'clip',
    poolLabel: 'Eight',
    size: 8,
    ids,
    now: 10,
  })
  const cur = BR.bracketState(b).current
  const picked = BR.pick(b, cur.b) // the lower seed: an upset
  const run = (br) =>
    createEngine(db).compute({ decisions: BR.modelDecisions(br) })
  const before = run(b)
  const after = run(picked)
  const undone = run(BR.undo(picked))
  assert.ok(after.estimate(cur.b) > before.estimate(cur.b))
  assert.ok(after.estimate(cur.a) < before.estimate(cur.a))
  for (const id of ids) assert.equal(undone.estimate(id), before.estimate(id))
})

test('performer pools: in the library, with a photo and a scene, of one gender', () => {
  const pool = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  assert.ok(pool.length >= 16)
  for (const id of pool) {
    const p = db.performers.get(id)
    assert.equal(p.local.gender, 'FEMALE')
    assert.ok(p.image, 'a photo')
    assert.ok(p.local.scene_count >= 1)
  }
  const noPhoto = db.localPerformers.filter(
    (p) => p.local.gender === 'FEMALE' && !p.image && p.local.scene_count,
  )
  assert.ok(noPhoto.length > 0)
  for (const p of noPhoto)
    assert.ok(!pool.includes(p.id), 'no photo, no bracket')
  const favs = BR.performerPool(M, { gender: 'FEMALE', pool: 'favorites' })
  assert.ok(
    favs.length > 0 && favs.every((id) => db.favoritePerformerIds.has(id)),
  )
  const some = new Set(pool.slice(0, 3))
  assert.deepEqual(
    BR.performerPool(M, { gender: 'FEMALE', pool: 'filter', filterIds: some }),
    [...some],
  )
  // Set genders: a performer with none joins once one is set
  const none = BR.genderless(M).filter(BR.eligible)
  assert.ok(none.length > 0)
  assert.ok(none.every((p) => p.local.gender === null))
  const set = (p) => (p.id === none[0].id ? 'FEMALE' : p.local.gender)
  assert.ok(
    BR.performerPool(M, { gender: 'FEMALE', pool: 'library' }, set).includes(
      none[0].id,
    ),
  )
})

test('a performer bracket seeds by affinity and plays to a result', () => {
  const ids = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  const size = BR.resolveSize(16, ids.length)
  const b = BR.createBracket(M, {
    kind: 'performer',
    gender: 'FEMALE',
    poolLabel: 'Female',
    size,
    ids,
    now: 7,
  })
  assert.equal(b.seeds.length, 16)
  const strongest = ids
    .slice()
    .sort((x, y) => M.performerAffinity(y) - M.performerAffinity(x))
  assert.deepEqual(b.seeds, strongest.slice(0, 16))
  assert.equal(b.id, 'b' + (7).toString(36))
  const done = playOut(b)
  assert.equal(done.decisions.length, 15)
  // the higher seed wins every match: seeds 1 and 2 meet in the final
  const seed = (n) => b.seeds[n - 1]
  assert.deepEqual(done.result, {
    champion: seed(1),
    finalist: seed(2),
    semifinalists: [seed(4), seed(3)],
    quarterfinalists: [seed(8), seed(5), seed(7), seed(6)],
  })
})

// finished brackets for the Hall of Fame
const finished = (
  kind,
  gender,
  champion,
  finalist,
  finishedAt,
  champions = false,
) => ({
  id: 'h' + finishedAt,
  kind,
  gender,
  champions,
  finishedAt,
  result: {
    champion,
    finalist,
    semifinalists: ['s1', 's2'],
    quarterfinalists: ['q1', 'q2', 'q3', 'q4'],
  },
})
const history = [
  finished('performer', 'FEMALE', 'a', 'b', '2026-06-01T20:00:00Z'),
  finished('performer', 'FEMALE', 'b', 'a', '2026-07-01T20:00:00Z'),
  finished('performer', 'MALE', 'm', 'n', '2026-07-15T20:00:00Z'),
  finished('performer', 'FEMALE', 'c', 'a', '2026-08-01T20:00:00Z'),
  finished('performer', 'FEMALE', 'a', 'd', '2026-09-01T20:00:00Z'),
  finished('performer', 'FEMALE', 'e', 'a', '2026-09-15T20:00:00Z', true),
  finished('clip', null, 'x', 'y', '2026-09-20T20:00:00Z'),
  { id: 'paused', kind: 'performer', gender: 'FEMALE', decisions: [] },
]

test('honours, champions and the Champions round', () => {
  const h = BR.performerHonours(history)
  assert.deepEqual(h.a, { champion: 2, finalist: 3 })
  assert.deepEqual(h.e, { champion: 1, finalist: 0 })
  assert.equal(h.x, undefined, 'clip brackets are not performer honours')
  assert.deepEqual(
    BR.championsOf(history, 'FEMALE'),
    ['a', 'c', 'b'],
    'distinct, newest first, no Champions rounds',
  )
  assert.deepEqual(BR.championsOf(history, 'MALE'), ['m'])
  assert.deepEqual(
    [0, 3, 4, 5, 7, 8, 15, 16, 30].map(BR.championsRoundSize),
    [0, 0, 4, 4, 4, 8, 8, 16, 16],
  )
  assert.equal(BR.CHAMPIONS_MIN, 4)
})

test('custom fields: titles count up and the best finish never goes down', () => {
  assert.equal(BR.FIELDS.titles, FIELD_PREFIX + 'titles')
  assert.equal(BR.FIELDS.best, FIELD_PREFIX + 'best_finish')
  assert.equal(BR.FIELDS.last, FIELD_PREFIX + 'last_bracket')
  const b = finished('performer', 'FEMALE', 'a', 'b', '2026-10-02T20:00:00Z')
  const current = {
    a: {
      [BR.FIELDS.titles]: 2,
      [BR.FIELDS.best]: 'champion',
      other: 'kept by Stash',
    },
    b: { [BR.FIELDS.titles]: 1, [BR.FIELDS.best]: 'champion' },
    s1: { [BR.FIELDS.best]: 'quarterfinal' },
  }
  const up = BR.bracketFieldUpdates(current, b)
  assert.deepEqual(Object.keys(up).sort(), [
    'a',
    'b',
    'q1',
    'q2',
    'q3',
    'q4',
    's1',
    's2',
  ])
  assert.deepEqual(up.a, {
    [BR.FIELDS.titles]: 3,
    [BR.FIELDS.best]: 'champion',
    [BR.FIELDS.last]: '2026-10-02',
  })
  assert.equal(up.b[BR.FIELDS.titles], 1)
  assert.equal(
    up.b[BR.FIELDS.best],
    'champion',
    'a final does not undo a title',
  )
  assert.equal(up.s1[BR.FIELDS.best], 'semifinal', 'a better finish moves up')
  assert.equal(up.q1[BR.FIELDS.best], 'quarterfinal')
  assert.equal(up.q1[BR.FIELDS.titles], 0)
  assert.deepEqual(
    BR.bracketFieldUpdates(
      current,
      finished('clip', null, 'x', 'y', '2026-10-02'),
    ),
    {},
  )
  const all = BR.fieldsFromHistory(history)
  assert.equal(all.a[BR.FIELDS.titles], 2)
  assert.equal(all.a[BR.FIELDS.best], 'champion')
  assert.equal(all.a[BR.FIELDS.last], '2026-09-15')
  assert.equal(all.e[BR.FIELDS.titles], 1)
  assert.equal(all.x, undefined)
})

test('Apply to my ratings: unrated only by default; includeRated raises, never lowers', () => {
  const ids = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  const done = playOut(
    BR.createBracket(M, {
      kind: 'performer',
      gender: 'FEMALE',
      poolLabel: 'Female',
      size: 16,
      ids,
      now: 8,
    }),
  )
  const r = done.result
  const placed = [
    r.champion,
    r.finalist,
    ...r.semifinalists,
    ...r.quarterfinalists,
  ]
  const tier = new Map([
    [r.champion, 100],
    [r.finalist, 90],
    ...r.semifinalists.map((id) => [id, 80]),
    ...r.quarterfinalists.map((id) => [id, 70]),
  ])
  // set ratings around the tiers: none, below and above
  const performerOverrides = {
    [r.champion]: null,
    [r.finalist]: 100,
    [r.semifinalists[0]]: 40,
    [r.semifinalists[1]]: null,
    [r.quarterfinalists[0]]: 70,
    [r.quarterfinalists[1]]: 90,
    [r.quarterfinalists[2]]: null,
    [r.quarterfinalists[3]]: 60,
  }
  const Mx = createEngine(db).compute({ performerOverrides })
  const unrated = BR.ratingProposals(Mx, done, false)
  assert.deepEqual(
    unrated.map((x) => x.id).sort(),
    placed.filter((id) => performerOverrides[id] == null).sort(),
  )
  for (const x of unrated) {
    assert.equal(x.from, null)
    assert.equal(x.to, tier.get(x.id))
  }
  const raised = BR.ratingProposals(Mx, done, true)
  for (const x of raised)
    assert.ok(x.from == null || x.to > x.from, 'never lowers')
  assert.deepEqual(
    raised.map((x) => x.id).sort(),
    [
      r.champion,
      r.semifinalists[0],
      r.semifinalists[1],
      r.quarterfinalists[2],
      r.quarterfinalists[3],
    ].sort(),
  )
  assert.deepEqual(
    BR.TIERS.map(([, to]) => to),
    [100, 90, 80, 70],
  )
  // clip brackets propose scene ratings
  const clipIds = BR.watchedScenes(db)
    .filter((s) => M.rating(s) == null)
    .slice(0, 4)
    .map((s) => s.id)
  const clip = playOut(
    BR.createBracket(M, {
      kind: 'clip',
      poolLabel: 'Four',
      size: 4,
      ids: clipIds,
      now: 9,
    }),
  )
  assert.equal(BR.ratingProposals(M, clip, false).length, 4)
})
