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
  assert.equal(b.slots.length, 8)
  let st = BR.bracketState(b)
  const first = st.rounds[0]
  assert.equal(first.filter((m) => m.bye).length, 1)
  assert.equal(st.label, 'Quarterfinals · match 1 of 3')
  assert.equal(st.totalMatches, 6)
  const done = playOut(b)
  assert.equal(done.decisions.length, 6)
  st = BR.bracketState(done)
  assert.equal(st.done, true)
  assert.equal(st.label, 'Finished')
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
  const picked = BR.pick(b, cur.b)
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

test('a performer bracket: half anchors, half candidates, each candidate meets an anchor first', () => {
  const ids = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  const role = (id) => BR.entrantRole(M, 'performer', id)
  const anchorsIn = ids.filter((id) => role(id) === 'anchor')
  const candidatesIn = ids.filter((id) => role(id) === 'candidate')
  assert.ok(anchorsIn.length >= 8 && candidatesIn.length >= 8, 'the fixture')
  const b = BR.createBracket(M, {
    kind: 'performer',
    gender: 'FEMALE',
    poolLabel: 'Female',
    size: 16,
    ids,
    now: 7,
  })
  assert.equal(b.id, 'b' + (7).toString(36))
  assert.equal(b.seeds.length, 16)
  const anchors = Object.keys(b.anchors)
  assert.equal(anchors.length, 8)
  for (const id of anchors) {
    assert.equal(role(id), 'anchor')
    assert.equal(b.anchors[id], M.stashPerformerRating(id))
  }
  const candidates = b.seeds.filter((id) => !(id in b.anchors))
  assert.ok(candidates.every((id) => role(id) === 'candidate'))
  // anchors span the user's scale; candidates the model's whole range
  const rating = (id) => M.stashPerformerRating(id)
  const ratings = anchorsIn.map(rating)
  assert.equal(Math.max(...anchors.map(rating)), Math.max(...ratings))
  assert.equal(Math.min(...anchors.map(rating)), Math.min(...ratings))
  const aff = (id) => M.performerAffinity(id)
  const byAff = candidatesIn.slice().sort((x, y) => aff(y) - aff(x))
  assert.ok(candidates.includes(byAff[0]), 'the strongest candidate')
  assert.ok(candidates.includes(byAff.at(-1)), 'and the weakest')
  // every first-round match is an anchor against a candidate, by rank
  const first = BR.bracketState(b).rounds[0]
  for (const m of first)
    assert.notEqual(m.a in b.anchors, m.b in b.anchors, 'one of each')
  const top = anchors.slice().sort((x, y) => rating(y) - rating(x))[0]
  const strongest = candidates.slice().sort((x, y) => aff(y) - aff(x))[0]
  const topMatch = first.find((m) => m.a === top || m.b === top)
  assert.ok([topMatch.a, topMatch.b].includes(strongest))
  // the sides are drawn from `now`: the same each time, not always the anchor's
  assert.deepEqual(
    BR.createBracket(M, { kind: 'performer', size: 16, ids, now: 7 }).slots,
    b.slots,
  )
  assert.ok(first.some((m) => m.a in b.anchors))
  assert.ok(first.some((m) => m.b in b.anchors))
  const done = playOut(b)
  assert.equal(done.decisions.length, 15)
  assert.ok(done.result.champion)
})

test('who plays: candidates and anchors share the slots, ranked records only fill', () => {
  const ids = Array.from({ length: 30 }, (_, i) => 'p' + i)
  const fake = (ratings, ranked = new Set()) => ({
    db: { performers: new Map(ids.map((id) => [id, { local: {} }])) },
    ratingSource: (_, id) => (ranked.has(id) ? 'elo' : null),
    stashPerformerRating: (id) => ratings[id] ?? null,
    performerAffinity: (id) => -Number(id.slice(1)),
  })
  const rated = (n) =>
    Object.fromEntries(ids.slice(0, n).map((id, i) => [id, 100 - i * 3]))
  const count = (r) => [r.anchors.length, r.candidates.length, r.ranked.length]
  assert.deepEqual(
    count(BR.composeEntrants(fake(rated(10)), 'performer', ids, 16)),
    [8, 8, 0],
  )
  assert.deepEqual(
    count(BR.composeEntrants(fake(rated(3)), 'performer', ids, 16)),
    [3, 13, 0],
    'few anchors: more candidates',
  )
  assert.deepEqual(
    count(BR.composeEntrants(fake(rated(26)), 'performer', ids, 16)),
    [12, 4, 0],
    'few candidates: more anchors',
  )
  const ranked = new Set(ids.slice(10))
  assert.deepEqual(
    count(BR.composeEntrants(fake(rated(4), ranked), 'performer', ids, 16)),
    [4, 6, 6],
    'ranked fill what is left',
  )
  const r = BR.composeEntrants(fake(rated(20)), 'performer', ids, 16)
  assert.deepEqual(
    r.anchors.map((id) => 100 - Number(id.slice(1)) * 3),
    r.anchors.map((id) => 100 - Number(id.slice(1)) * 3).sort((a, b) => b - a),
    'highest rated first',
  )
  assert.equal(r.anchors[0], 'p0', 'the top of the scale')
  assert.equal(r.anchors.at(-1), 'p19', 'and the bottom')
})

test('spreading: by rank keeps ties in order; linear spans the scale', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const flat = () => 0
  assert.deepEqual(
    BR.spreadPick(ids, flat, 3),
    ['a', 'b', 'c'],
    'all equal: the first',
  )
  const v = { a: 100, b: 98, c: 96, d: 94, e: 40, f: 20 }
  assert.deepEqual(
    BR.spreadPick(ids, (x) => v[x], 3, BR.linearTargets),
    ['a', 'e', 'f'],
  )
  assert.deepEqual(
    BR.spreadPick(ids, (x) => v[x], 3),
    ['a', 'd', 'f'],
  )
  assert.deepEqual(
    BR.spreadPick(ids, (x) => v[x], 9),
    ids,
    'k beyond the list',
  )
})

test('the first round: rank-matched pairs, byes to anchors first', () => {
  const pairOf = (slots, id) => {
    const i = slots.indexOf(id)
    return slots[i % 2 ? i - 1 : i + 1]
  }
  const a = ['a1', 'a2', 'a3']
  const u = ['u1', 'u2', 'u3', 'u4', 'u5']
  const slots = BR.firstRoundSlots(a, u, 8, 3)
  assert.deepEqual(slots.slice().sort(), [...a, ...u].sort())
  assert.equal(pairOf(slots, 'a1'), 'u1')
  assert.equal(pairOf(slots, 'a2'), 'u3')
  assert.equal(pairOf(slots, 'a3'), 'u5')
  assert.equal(pairOf(slots, 'u2'), 'u4', 'the rest play among themselves')
  // the top anchor's match and the next one's sit in opposite halves
  const half = (id) => (slots.indexOf(id) < 4 ? 0 : 1)
  assert.notEqual(half('a1'), half('a2'))
  // five in eight slots: one match, three byes, anchors' first
  const small = BR.firstRoundSlots(['a1', 'a2'], ['u1', 'u2', 'u3'], 8, 3)
  const byes = []
  for (let i = 0; i < 8; i += 2)
    if (!small[i] || !small[i + 1]) byes.push(small[i] || small[i + 1])
  assert.deepEqual(byes.sort(), ['a2', 'u2', 'u3'])
  assert.equal(pairOf(small, 'a1'), 'u1')
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

// Four anchors and four candidates from the Female pool, in a hand-built
// bracket of 8: the anchors' ratings set through performerOverrides
function handBracket({ anchorRatings, decisions = [], championRating = null }) {
  const pool = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  const [A1, A2, A3, A4, C1, C2, C3, C4] = pool.slice(0, 8)
  const ids = { A1, A2, A3, A4, C1, C2, C3, C4 }
  const performerOverrides = Object.fromEntries(pool.map((id) => [id, null]))
  const anchors = {}
  for (const [k, r] of Object.entries(anchorRatings || {})) {
    performerOverrides[ids[k]] = r
    anchors[ids[k]] = r
  }
  const Mx = createEngine(db).compute({ performerOverrides })
  const slots = [A1, C1, A2, C2, A3, C3, A4, C4]
  let b = {
    id: 'hand',
    kind: 'performer',
    size: 8,
    seeds: slots,
    slots,
    anchors,
    championRating,
    decisions: [],
  }
  for (const k of decisions) b = BR.pick(b, ids[k])
  const st = BR.bracketState(b)
  return { Mx, ids, b: { ...b, result: st.result, status: 'done' } }
}

test('Apply: each candidate rated from the anchors around it in the tree', () => {
  // Round one: C1 beats A1, A2 beats C2, C3 beats A3, A4 beats C4.
  // Semifinals: C1 beats A2, A4 beats C3. Final: A4 beats C1.
  const { Mx, ids, b } = handBracket({
    anchorRatings: { A1: 60, A2: 80, A3: 40, A4: 100 },
    decisions: ['C1', 'A2', 'C3', 'A4', 'C1', 'A4', 'A4'],
  })
  assert.equal(b.result.champion, ids.A4)
  const { rows, askChampion } = BR.ratingProposals(Mx, b)
  assert.equal(askChampion, false)
  const by = Object.fromEntries(rows.map((x) => [x.id, x]))
  const name = (k) => Mx.db.performers.get(ids[k]).name
  assert.deepEqual(
    Object.keys(by).sort(),
    [ids.C1, ids.C2, ids.C3, ids.C4].sort(),
    'anchors never',
  )
  // above A1 (3★) and A2 (4★), below A4 (5★): between the closest two
  assert.equal(by[ids.C1].to, 90)
  assert.equal(
    by[ids.C1].why,
    `Above ${name('A2')} (4.0★), below ${name('A4')} (5.0★)`,
  )
  // lost to A2, who lost to C1, who lost to A4: below A2
  assert.equal(by[ids.C2].to, 70)
  assert.equal(by[ids.C2].why, `Below ${name('A2')} (4.0★)`)
  assert.equal(by[ids.C3].to, 70, 'between 2★ and 5★')
  assert.equal(by[ids.C4].to, 90, 'just below the 5★ that beat it')
  assert.ok(rows.every((x) => !x.provisional && x.from == null))
  assert.deepEqual(
    rows.map((x) => x.short),
    [1, 2, 3, 3],
    'best finish first',
  )
  // a midpoint off the half-star grid keeps its quarter
  const q = handBracket({
    anchorRatings: { A1: 60, A2: 80, A3: 40, A4: 90 },
    decisions: ['C1', 'A2', 'C3', 'A4', 'C1', 'A4', 'A4'],
  })
  const c1 = BR.ratingProposals(q.Mx, q.b).rows.find((x) => x.id === q.ids.C1)
  assert.equal(c1.to, 85)
})

test('Apply: a champion that beat every anchor goes half a star above the best', () => {
  // C1 beats A1, C2 beats A2, C3 beats A3, C4 beats A4; C1 beats C2, C3
  // beats C4; C1 beats C3
  const { Mx, ids, b } = handBracket({
    anchorRatings: { A1: 70, A2: 90, A3: 50, A4: 100 },
    decisions: ['C1', 'C2', 'C3', 'C4', 'C1', 'C3', 'C1'],
  })
  const by = Object.fromEntries(
    BR.ratingProposals(Mx, b).rows.map((x) => [x.id, x]),
  )
  assert.equal(by[ids.C1].to, 100, 'above the 5★, capped')
  // above the 4.5★; the champion is no anchor, so no ceiling
  assert.equal(by[ids.C2].to, 100)
  assert.equal(by[ids.C4].to, 100)
})

test('Apply with no anchors: the champion is rated by hand, the rest step down', () => {
  const play = ['C1', 'C2', 'C3', 'C4', 'C1', 'C3', 'C1']
  const before = handBracket({ decisions: play })
  const asked = BR.ratingProposals(before.Mx, before.b)
  assert.equal(asked.askChampion, true)
  assert.deepEqual(asked.rows, [], 'nothing until the champion is rated')
  const { Mx, ids, b } = handBracket({ decisions: play, championRating: 80 })
  const { rows, askChampion } = BR.ratingProposals(Mx, b)
  assert.equal(askChampion, false)
  const by = Object.fromEntries(rows.map((x) => [x.id, x]))
  assert.equal(b.result.champion, ids.C1)
  assert.deepEqual(by[ids.C1], {
    id: ids.C1,
    from: null,
    to: 80,
    why: 'Your rating for the champion',
    provisional: false,
    short: 0,
  })
  assert.deepEqual(by[ids.C3], {
    id: ids.C3,
    from: null,
    to: 70,
    why: 'Finalist, ½★ under the champion',
    provisional: true,
    short: 1,
  })
  // the anchors of handBracket are candidates here: A1 to A4 lost in round
  // one, which gets nothing; C2 and C4 lost in the semifinals
  assert.equal(by[ids.C2].to, 60)
  assert.equal(by[ids.C2].why, 'Semifinalist, 1★ under the champion')
  assert.equal(by[ids.C4].to, 60)
  assert.equal(rows.length, 4)
})

test('Apply with one anchor: bounds where it reaches, steps from the champion elsewhere', () => {
  // C1 beats A1 (the only anchor, 3★), C2 beats A2, C3 beats A3, C4 beats A4;
  // C1 beats C2, C3 beats C4; C1 beats C3
  const { Mx, ids, b } = handBracket({
    anchorRatings: { A1: 60 },
    decisions: ['C1', 'C2', 'C3', 'C4', 'C1', 'C3', 'C1'],
  })
  const { rows, askChampion } = BR.ratingProposals(Mx, b)
  assert.equal(askChampion, false)
  const by = Object.fromEntries(rows.map((x) => [x.id, x]))
  assert.equal(by[ids.C1].to, 70, 'beat the 3★: half a star above')
  assert.equal(by[ids.C1].provisional, false)
  assert.equal(by[ids.C3].to, 60, 'a finalist: ½★ under the champion')
  assert.equal(by[ids.C3].provisional, true)
  assert.equal(by[ids.C2].to, 50)
  assert.equal(by[ids.A2], undefined, 'out in round one, unbounded: nothing')
})

test('Apply: ranked records and those rated since are left out', () => {
  const play = ['C1', 'A2', 'C3', 'A4', 'C1', 'A4', 'A4']
  const { ids, b } = handBracket({
    anchorRatings: { A1: 60, A2: 80, A3: 40, A4: 100 },
    decisions: play,
  })
  // C3 rated by the user since the bracket started
  const pool = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  const performerOverrides = Object.fromEntries(pool.map((id) => [id, null]))
  Object.assign(performerOverrides, {
    [ids.A1]: 60,
    [ids.A2]: 80,
    [ids.A3]: 40,
    [ids.A4]: 100,
    [ids.C3]: 30,
  })
  const Mx = createEngine(db).compute({ performerOverrides })
  const { rows } = BR.ratingProposals(Mx, b)
  assert.equal(
    rows.find((x) => x.id === ids.C3),
    undefined,
  )
  assert.equal(rows.length, 3)
})

test('a provisional rating counts as a candidate until the user changes it', () => {
  const lib = structuredClone(input)
  const [p1, p2, p3] = lib.performers.filter((p) => p.gender === 'FEMALE')
  p1.rating100 = 70
  p1.custom_fields = { [BR.PROVISIONAL_FIELD]: 70 }
  p2.rating100 = 70
  p2.custom_fields = { [BR.PROVISIONAL_FIELD]: '70' }
  p3.rating100 = 90 // changed by hand since
  p3.custom_fields = { [BR.PROVISIONAL_FIELD]: 70 }
  const Mx = createEngine(buildDb(lib)).compute({})
  assert.equal(BR.entrantRole(Mx, 'performer', p1.id), 'candidate')
  assert.equal(BR.entrantRole(Mx, 'performer', p2.id), 'candidate')
  assert.equal(BR.entrantRole(Mx, 'performer', p3.id), 'anchor')
  assert.equal(BR.PROVISIONAL_FIELD, FIELD_PREFIX + 'provisional')
  assert.ok(BR.ownFieldsOn(p1.custom_fields).includes(BR.PROVISIONAL_FIELD))
})

test('the provisional mark on write and on Undo', () => {
  const F = BR.PROVISIONAL_FIELD
  assert.deepEqual(BR.provisionalFieldsInput(70, true, null), {
    partial: { [F]: 70 },
  })
  assert.deepEqual(
    BR.provisionalFieldsInput(80, false, 70),
    { remove: [F] },
    'measured now',
  )
  assert.equal(
    BR.provisionalFieldsInput(80, false, null),
    null,
    'nothing to touch',
  )
  assert.deepEqual(
    BR.restoreProvisionalInput({ provisional: true, fromProvisional: null }),
    { remove: [F] },
  )
  assert.deepEqual(
    BR.restoreProvisionalInput({ provisional: false, fromProvisional: 70 }),
    { partial: { [F]: 70 } },
  )
  assert.equal(
    BR.restoreProvisionalInput({ provisional: false, fromProvisional: null }),
    null,
  )
  const current = new Map([
    ['1', { id: '1', rating100: 70, custom_fields: { [F]: 70 } }],
  ])
  assert.deepEqual(
    BR.writableChanges([{ id: '1', to: 90, provisional: false }], current),
    {
      write: [
        { id: '1', to: 90, provisional: false, from: 70, fromProvisional: 70 },
      ],
      ranked: [],
    },
  )
})

test('clip brackets propose scene ratings the same way', () => {
  const watched = BR.watchedScenes(db).map((s) => s.id)
  const b = playOut(
    BR.createBracket(M, {
      kind: 'clip',
      poolLabel: 'All',
      size: 16,
      ids: watched,
      now: 9,
    }),
  )
  const { rows } = BR.ratingProposals(M, b)
  assert.ok(rows.length > 0)
  for (const x of rows) {
    assert.equal(BR.entrantRole(M, 'clip', x.id), 'candidate')
    assert.ok(x.to >= 10 && x.to <= 100)
    assert.ok(!(x.id in b.anchors))
  }
})

test('a bracket from before anchors seeds 1 v N and takes the anchors it has now', () => {
  const ids = BR.performerPool(M, { gender: 'FEMALE', pool: 'library' })
  const aff = (id) => M.performerAffinity(id)
  const seeds = ids
    .slice()
    .sort((x, y) => aff(y) - aff(x))
    .slice(0, 16)
  const old = { id: 'old', kind: 'performer', size: 16, seeds, decisions: [] }
  const first = BR.bracketState(old).rounds[0]
  assert.deepEqual([first[0].a, first[0].b], [seeds[0], seeds[15]])
  const done = playOut(old)
  const { rows } = BR.ratingProposals(M, done)
  for (const x of rows)
    assert.equal(BR.entrantRole(M, 'performer', x.id), 'candidate')
})
