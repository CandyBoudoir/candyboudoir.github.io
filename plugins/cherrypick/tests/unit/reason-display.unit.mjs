// Reasons on cards: the setting, and the icon each reason of For you and
// the rows that follow it shows under Icon, picked with the reason
// (model/foryou.js), never read from it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDb } from '../../src/js/model/db.js'
import { createEngine } from '../../src/js/model/index.js'
import * as FY from '../../src/js/model/foryou.js'
import {
  MANIFEST_SETTINGS,
  REASON_DISPLAYS,
  reasonDisplayOf,
  SETTING_DEFAULTS,
} from '../../src/js/storage/settings.js'
import { syntheticLibrary, withRecentPlays } from './fixtures/synthetic.mjs'

const DAY = 86400000

test('Reasons on cards is a STRING setting that starts on Text', () => {
  const s = MANIFEST_SETTINGS.find((x) => x.key === 'reasonDisplay')
  assert.equal(s.type, 'STRING')
  assert.equal(SETTING_DEFAULTS.reasonDisplay, 'text')
  assert.deepEqual(REASON_DISPLAYS, ['text', 'icon', 'off'])
})

test("a value typed into Stash's text box counts whatever its case; anything else is Text", () => {
  for (const v of REASON_DISPLAYS) assert.equal(reasonDisplayOf(v), v)
  assert.equal(reasonDisplayOf(' Icon '), 'icon')
  assert.equal(reasonDisplayOf('OFF'), 'off')
  for (const v of ['', null, undefined, 'icons', 'none', 0, true])
    assert.equal(reasonDisplayOf(v), 'text', String(v))
})

// ------------------------------------------------------------ the icons

const NOW = Date.UTC(2026, 9, 31, 12)
// A model with no stated picks (ratingsToGo 0) and one reason of Your
// score's per scene, for one card at a time
const ctx = (over = {}) => ({
  now: NOW,
  M: {
    ratingsToGo: 0,
    rating: () => null,
    reasons: (id) => [{ text: `Your score's reason for ${id}`, key: 't' }],
    ...over,
  },
  db: { favoritePerformerIds: new Set(), performers: new Map() },
})
const card = (kind, f, m = { source: null, value: 0 }) => ({
  kind,
  scene: { id: '7', performers: [] },
  f,
  m,
})
const pick = (c, x = ctx()) => FY.assignReasons(x, [c])[0]
const performerSource = {
  kind: 'performer',
  p: { name: 'Ava' },
  f: { oldest: 3, scenes: new Set(['1', '2']) },
}

test('recent watching shows the trend arrow', () => {
  const r = pick(
    card('main', { kind: 'recent' }, { source: performerSource, value: 0.5 }),
  )
  assert.match(r.text, /^Because you watched two of Ava's this week/)
  assert.equal(r.icon, 'trend')
  const tag = pick(
    card(
      'main',
      { kind: 'recent' },
      {
        source: {
          kind: 'tag',
          t: { name: 'Outdoors' },
          f: { oldest: 9, scenes: new Set(['1']) },
        },
        value: 0.5,
      },
    ),
  )
  assert.equal(tag.text, 'Like your last few plays: Outdoors')
  assert.equal(tag.icon, 'trend')
})

test('a scene never watched shows the seedling, compounds included', () => {
  assert.deepEqual(pick(card('main', { kind: 'new' })), {
    kind: 'fresh',
    icon: 'seedling',
    text: 'New in your library',
  })
  const never = pick(card('main', { kind: 'never', looked: false }))
  assert.match(never.text, /^Never played · your score's reason for 7$/)
  assert.equal(never.icon, 'seedling')
  const looked = pick(card('main', { kind: 'never', looked: true }), {
    ...ctx({ reasons: () => [] }),
  })
  assert.equal(looked.text, 'Not watched yet')
  assert.equal(looked.icon, 'seedling')
})

test('a scene not watched in a while shows the clock, forgotten favorites too', () => {
  const long = pick(card('main', { kind: 'long', last: NOW - 200 * DAY }))
  assert.match(long.text, /^Not watched since /)
  assert.equal(long.icon, 'clock')
  const mid = pick(card('main', { kind: 'mid', last: NOW - 30 * DAY }), {
    ...ctx({ rating: () => 90 }),
  })
  assert.match(mid.text, /^Last watched .*; you rated it 4\.5★$/)
  assert.equal(mid.icon, 'clock')
  const forgotten = pick(
    card('forgotten', { kind: 'long', last: NOW - 120 * DAY }),
  )
  assert.equal(forgotten.kind, 'explore')
  assert.equal(forgotten.icon, 'clock')
  // a forgotten card with no freshness sentence
  const favorite = pick(card('forgotten', { kind: 'recent' }))
  assert.equal(favorite.text, 'One of your favorites')
  assert.equal(favorite.icon, 'clock')
})

test('taste shows the cherries, down to the last fallback', () => {
  const score = pick(card('main', { kind: 'recent' }))
  assert.deepEqual(score, {
    kind: 'taste',
    icon: 'cherries',
    text: "Your score's reason for 7",
  })
  const plain = pick(card('main', { kind: 'recent' }), ctx({ reasons: null }))
  assert.equal(plain.text, 'A lot like scenes you rate well')
  assert.equal(plain.icon, 'cherries')
  const cold = pick(
    card('main', { kind: 'recent' }),
    ctx({ ratingsToGo: 3, reasons: null, performerRating: () => null }),
  )
  assert.equal(cold.text, 'From your library')
  assert.equal(cold.icon, 'cherries')
})

test('a near miss shows the flask', () => {
  const r = pick(card('nearmiss', { kind: 'never', looked: false }))
  assert.match(r.text, /^Worth a try: your score's reason for 7$/)
  assert.equal(r.icon, 'flask')
})

// ------------------------------------------------------------ on a library

const { input } = syntheticLibrary()
const STATE = {
  dontLearn: [],
  notInterested: [],
  settings: { excludedTags: '' },
}

// What each sentence's icon should be, read from its words here only, to
// check the model's pick over a whole library
const expected = (text) =>
  /^(Because you watched|Like your last few plays)/.test(text)
    ? 'trend'
    : /^(New in your library|Not watched yet|Never played)/.test(text)
      ? 'seedling'
      : /^(Not watched since|Last watched|One of your favorites)/.test(text)
        ? 'clock'
        : /^Worth a try/.test(text)
          ? 'flask'
          : 'cherries'

// The synthetic library with a fortnight of heavy watching, so the row has
// momentum, freshness, taste and both exploration cards
function library() {
  const base = buildDb(input)
  const loved = [...base.localPerformers]
    .sort((a, b) => b.ownedSceneIds.length - a.ownedSceneIds.length)
    .slice(0, 3)
  const plays = loved.flatMap((p, k) =>
    p.ownedSceneIds.slice(0, 4).map((sceneId, j) => ({
      sceneId,
      at: input.asOf - (1 + ((j + k) % 10)) * DAY,
    })),
  )
  const db = buildDb(withRecentPlays(input, plays))
  const M = createEngine(db).compute({})
  return FY.context(M, STATE)
}

test("every card of For you's row carries the icon of its reason", () => {
  const c = library()
  const row = FY.computeForYou(c, FY.EMPTY_SIGNALS)
  for (const it of row) assert.equal(it.reasonIcon, expected(it.reason))
  const icons = new Set(row.map((it) => it.reasonIcon))
  for (const icon of ['trend', 'clock', 'flask'])
    assert.ok(icons.has(icon), `no ${icon} in ${[...icons]}`)
})

test('every card of the rows that follow For you carries the icon of its reason', () => {
  const c = library()
  const fy = FY.computeForYou(c, FY.EMPTY_SIGNALS)
  const rows = FY.followRows(
    c,
    FY.EMPTY_SIGNALS,
    fy.map((it) => it.scene.id),
  )
  assert.ok(rows.length, 'no row follows For you')
  const icons = new Set()
  for (const row of rows)
    for (const it of row.items) {
      assert.match(it.reason, /^[A-Z].{8,}/)
      assert.equal(it.reasonIcon, expected(it.reason), it.reason)
      icons.add(it.reasonIcon)
    }
  // freshness or taste: what you watched lately is the row's own title
  for (const icon of icons)
    assert.ok(['seedling', 'clock', 'cherries'].includes(icon), icon)
  assert.ok(icons.size > 1, `only ${[...icons]}`)
})

test("each page of For you's tab spreads its reasons as the row does, and keeps the row's", () => {
  const c = library()
  const row = FY.computeForYou(c, FY.EMPTY_SIGNALS)
  const list = FY.forYouList(c, FY.EMPTY_SIGNALS, { row })
  const per = 40
  assert.ok(list.length > per)
  for (let at = 0; at < list.length; at += per) {
    const page = list.slice(at, at + per)
    const reasons = FY.pageReasons(c, page)
    assert.equal(reasons.length, page.length)
    const kinds = new Map()
    const texts = new Map()
    reasons.forEach((r, i) => {
      assert.match(r.text, /^[A-Z].{8,}/)
      assert.equal(r.icon, expected(r.text), r.text)
      kinds.set(r.kind, (kinds.get(r.kind) || 0) + 1)
      texts.set(r.text, (texts.get(r.text) || 0) + 1)
      // the row's own cards say on the tab what they said on the front page
      if (!page[i].x) {
        assert.equal(r.text, page[i].reason)
        assert.equal(r.icon, page[i].reasonIcon)
      }
    })
    for (const [kind, n] of kinds)
      assert.ok(n <= Math.ceil(page.length / 2), `${n} ${kind} on one page`)
    for (const [text, n] of texts)
      assert.ok(n <= 2, `"${text}" on ${n} cards of one page`)
  }
})
