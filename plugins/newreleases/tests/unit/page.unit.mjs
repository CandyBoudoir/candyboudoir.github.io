// The page's pure parts: naming releases with the user's own tags and
// performers, marking the ones they have, the filters in the address, and
// when the page starts a check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  ago,
  linkedStudios,
  problems,
  shouldStart,
  STALE,
} from '../../src/js/data/catalog.js'
import {
  applyFilters,
  EMPTY,
  formatFilters,
  optionsOf,
  parseFilters,
} from '../../src/js/data/filters.js'
import {
  nameKey,
  ownedIndex,
  performerIndex,
  presentReleases,
  tagIndex,
  urlKey,
} from '../../src/js/data/match.js'

const BOX = 'https://box.example/graphql'
const TPDB = 'https://theporndb.net/graphql'

const studios = [
  { id: '1', name: 'Lollipop Lounge', image_path: 'x?default=true' },
  { id: '2', name: 'Fudge Factory', image_path: 'y' },
]

const tags = tagIndex([
  { id: '10', name: 'Candy', aliases: ['Sweets'], stash_ids: [] },
  {
    id: '11',
    name: 'Glossy',
    aliases: [],
    stash_ids: [
      { endpoint: `${BOX}/`, stash_id: 'box-glossy' },
      { endpoint: TPDB, stash_id: 'tpdb-glossy' },
    ],
  },
  // Two tags share an alias, so neither takes it
  { id: '12', name: 'Pop', aliases: ['Fizz'], stash_ids: [] },
  { id: '13', name: 'Soda', aliases: ['Fizz'], stash_ids: [] },
])
const performers = performerIndex([
  {
    id: '20',
    name: 'Gumdrop Gigi',
    alias_list: [],
    stash_ids: [{ endpoint: TPDB, stash_id: 'tpdb-gigi' }],
  },
  { id: '21', name: 'Bonbon Bijou', alias_list: ['Bijou B'], stash_ids: [] },
  { id: '22', name: 'Crème Brûlée', alias_list: [], stash_ids: [] },
])

const catalog = {
  releases: [
    {
      id: 'a',
      endpoint: TPDB,
      studio: '1',
      title: 'Older',
      date: '2026-09-01',
      url: 'https://lollipop.example/clips/older',
      performers: [
        { id: 'tpdb-gigi', name: 'Gigi G' },
        { id: 'x', name: 'Nougat Nova' },
      ],
      tags: [
        { id: 't1', name: 'sweets' },
        { id: 't2', name: 'Fizz' },
      ],
    },
    {
      id: 'b',
      endpoint: TPDB,
      studio: '1',
      title: 'Newest',
      date: '2026-10-10',
      url: 'https://www.lollipop.example/clips/newest/',
      performers: [
        { id: 'y', name: 'Bijou', also: ['Bonbon Bijou'] },
        { id: 'z', name: 'creme brulee' },
      ],
      tags: [{ id: 'tpdb-glossy', name: 'Shiny' }],
    },
    {
      id: 'c',
      endpoint: BOX,
      studio: '2',
      title: 'Box one',
      date: '2026-10-01',
      url: null,
      performers: [],
      tags: [
        { id: 'box-glossy', name: 'Shiny' },
        { id: 't1', name: 'Candy' },
      ],
    },
    // A studio no longer favourited
    {
      id: 'd',
      endpoint: BOX,
      studio: '9',
      title: 'Gone',
      date: '2026-10-11',
      performers: [],
      tags: [],
    },
  ],
}

const owned = ownedIndex([
  { id: '100', stash_ids: [{ endpoint: TPDB, stash_id: 'a' }], urls: [] },
  { id: '101', stash_ids: [], urls: ['http://lollipop.example/clips/newest'] },
])

const present = () =>
  presentReleases(catalog, { studios, tags, performers, owned })

test('releases come newest first, from favourite studios only', () => {
  assert.deepEqual(
    present().map((r) => r.title),
    ['Newest', 'Box one', 'Older'],
  )
})

test("a stash-box's tags and performers take the user's names, by StashID first, then name or alias", () => {
  const [newest, box, older] = present()
  // By StashID, whatever the stash-box calls them; the endpoint's trailing
  // slash makes no difference
  assert.deepEqual(older.performers[0], {
    key: '20',
    name: 'Gumdrop Gigi',
    local: '20',
  })
  assert.deepEqual(newest.tags[0], { key: '11', name: 'Glossy', local: '11' })
  assert.deepEqual(
    box.tags.map((t) => t.key),
    ['11', '10'],
  )
  // By alias, by ThePornDB's other name for them, and with accents and case ignored
  assert.deepEqual(older.tags[0], { key: '10', name: 'Candy', local: '10' })
  assert.deepEqual(
    newest.performers.map((p) => p.local),
    ['21', '22'],
  )
  // Unmatched, or matching two of theirs: the stash-box's name
  assert.deepEqual(older.performers[1], {
    key: '~nougat nova',
    name: 'Nougat Nova',
    local: null,
  })
  assert.deepEqual(older.tags[1], { key: '~fizz', name: 'Fizz', local: null })
})

test('a release is owned by StashID or by its address', () => {
  const [newest, box, older] = present()
  assert.equal(older.owner, '100')
  // No scheme, "www." or trailing slash in the comparison
  assert.equal(newest.owner, '101')
  assert.equal(box.owner, null)
  assert.equal(urlKey('https://WWW.Shop.example/a/?x=1'), 'shop.example/a?x=1')
  assert.equal(urlKey('ftp://shop.example/a'), null)
  assert.equal(nameKey('Crème-Brûlée!'), 'cremebrulee')
})

test('filters live in the address and come back the same', () => {
  const f = {
    studios: ['1', '2'],
    performers: [
      { key: '20', exclude: false },
      { key: '~nougat nova', exclude: true },
    ],
    tags: [{ key: '10', exclude: false }],
    days: 30,
    hideOwned: true,
  }
  const search = formatFilters(f, '?other=1')
  assert.equal(
    search,
    '?other=1&studio=1&studio=2&performer=20&performer=-%7Enougat+nova&tag=10&days=30&owned=hide',
  )
  assert.deepEqual(parseFilters(search), f)
  assert.deepEqual(parseFilters(''), EMPTY)
  assert.equal(formatFilters(EMPTY), '')
  // An unknown window is any time
  assert.equal(parseFilters('?days=12').days, 0)
})

test('filters: any of the studios and performers, all of the tags, none left out', () => {
  const list = present()
  const titles = (f) =>
    applyFilters(list, { ...EMPTY, ...f }, Date.parse('2026-10-15')).map(
      (r) => r.title,
    )
  assert.deepEqual(titles({}), ['Newest', 'Box one', 'Older'])
  assert.deepEqual(titles({ studios: ['2'] }), ['Box one'])
  assert.deepEqual(titles({ performers: [{ key: '20' }, { key: '21' }] }), [
    'Newest',
    'Older',
  ])
  assert.deepEqual(titles({ performers: [{ key: '20', exclude: true }] }), [
    'Newest',
    'Box one',
  ])
  assert.deepEqual(titles({ tags: [{ key: '11' }, { key: '10' }] }), [
    'Box one',
  ])
  assert.deepEqual(titles({ tags: [{ key: '11', exclude: true }] }), ['Older'])
  assert.deepEqual(titles({ days: 30 }), ['Newest', 'Box one'])
  assert.deepEqual(titles({ hideOwned: true }), ['Box one'])
})

test('the filter options count their releases, most first', () => {
  assert.deepEqual(
    optionsOf(present(), 'tags').map((o) => [o.name, o.count]),
    [
      ['Candy', 2],
      ['Glossy', 2],
      ['Fizz', 1],
    ],
  )
})

test('studios with no StashID on a stash-box Stash knows are listed apart', () => {
  const { linked, unlinked } = linkedStudios(
    [
      { id: '1', stash_ids: [{ endpoint: `${BOX}/`, stash_id: 's' }] },
      {
        id: '2',
        stash_ids: [
          { endpoint: 'https://gone.example/graphql', stash_id: 's' },
        ],
      },
      { id: '3', stash_ids: [] },
    ],
    [{ endpoint: BOX }],
  )
  assert.deepEqual(
    linked.map((s) => s.id),
    ['1'],
  )
  assert.deepEqual(
    unlinked.map((s) => s.id),
    ['2', '3'],
  )
})

test('the page starts a check when the catalog is missing, a day old, unfinished or missing a new favourite', () => {
  const now = Date.parse('2026-10-19T12:00:00Z')
  const linked = [{ id: '1' }, { id: '2' }]
  const run = (finished, favourites = ['1', '2']) => ({
    run: { finished, favourites },
  })
  const recent = new Date(now - 60_000).toISOString()
  assert.equal(shouldStart({ catalog: null, linked, now }), true)
  assert.equal(shouldStart({ catalog: run(null), linked, now }), true)
  assert.equal(shouldStart({ catalog: run(recent), linked, now }), false)
  assert.equal(
    shouldStart({
      catalog: run(new Date(now - STALE).toISOString()),
      linked,
      now,
    }),
    true,
  )
  assert.equal(shouldStart({ catalog: run(recent, ['1']), linked, now }), true)
  // Never with one already queued, or nothing to ask about
  assert.equal(shouldStart({ catalog: null, linked, queued: true, now }), false)
  assert.equal(shouldStart({ catalog: null, linked: [], now }), false)
})

test('the page says what is wrong with a stash-box or a studio', () => {
  const now = Date.parse('2026-10-19T12:00:00Z')
  const lines = problems(
    {
      boxes: {
        a: { name: 'NoKey', error: 'no API key' },
        b: { name: 'Refuser', error: 'refused the API key (HTTP 401)' },
        c: {
          name: 'Busy',
          error: 'stopped: HTTP 429, too many requests',
          pausedUntil: '2026-10-20T08:00:00Z',
        },
        d: {
          name: 'Over',
          error: 'stopped: HTTP 503',
          pausedUntil: '2026-10-19T08:00:00Z',
        },
      },
      studios: {
        1: { name: 'Lost', error: 'not found on ThePornDB' },
        2: { name: 'Unfavourited', error: 'not found on ThePornDB' },
      },
    },
    [{ id: '1' }],
    now,
  ).map((l) => l.key)
  assert.deepEqual(lines, ['key:a', 'refused:b', 'paused:c', 'not-found'])
  assert.equal(ago('2026-10-19T09:00:00Z', now), '3 hours ago')
  assert.equal(ago('2026-10-18T10:00:00Z', now), 'yesterday')
})

test("the manifest runs the task with Stash's Python and serves the catalog folder", async () => {
  const manifest = await readFile(
    new URL('../../src/NewReleases.yml', import.meta.url),
    'utf8',
  )
  assert.match(
    manifest,
    /^exec:\n {2}- python\n {2}- '\{pluginDir\}\/newreleases\.py'$/m,
  )
  assert.match(manifest, /^interface: raw$/m)
  assert.match(manifest, /assets:\n {4}\/catalog: catalog/)
  assert.match(manifest, /- name: Check for new releases\n/)
  const name = await readFile(
    new URL('../../src/js/name.js', import.meta.url),
    'utf8',
  )
  assert.match(name, /TASK_NAME = 'Check for new releases'/)
  assert.match(name, /assets\/catalog\/catalog\.json/)
})
