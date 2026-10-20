// The page's pure parts: naming releases with the user's own tags and
// performers, hiding the ones they have, the filters, order and page in the
// address, the sorts, which releases are New, where a running check's
// arrivals go, and when the page starts a check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  ago,
  CATALOG_VERSION,
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
  pageOf,
  parseFilters,
} from '../../src/js/data/filters.js'
import {
  isNew,
  newestFirst,
  newSince,
  sortReleases,
  SORTS,
  splitArrivals,
} from '../../src/js/data/sort.js'
import {
  nameKey,
  ownedIndex,
  performerIndex,
  presentReleases,
  releaseKey,
  tagIndex,
  uncovered,
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
      description: 'The newest one.',
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

test('filters and the page live in the address, as Stash keeps its lists', () => {
  const f = {
    studios: ['1', '2'],
    performers: [
      { key: '20', exclude: false },
      { key: '~nougat nova', exclude: true },
    ],
    tags: [{ key: '10', exclude: false }],
    sortBy: 'title',
    sortDir: 'asc',
    seed: null,
    page: 3,
    perPage: 120,
  }
  const search = formatFilters(f, '?other=1')
  assert.equal(
    search,
    '?other=1&studio=1&studio=2&performer=20&performer=-%7Enougat+nova&tag=10&sortby=title&sortdir=asc&p=3&perPage=120',
  )
  assert.deepEqual(parseFilters(search), f)
  assert.deepEqual(parseFilters(''), EMPTY)
  assert.deepEqual(EMPTY, {
    studios: [],
    performers: [],
    tags: [],
    sortBy: 'date',
    sortDir: 'desc',
    seed: null,
    page: 1,
    perPage: 40,
  })
  assert.equal(formatFilters(EMPTY), '')
  // Nonsense falls back to Stash's defaults, and a page size to at most 1000
  assert.deepEqual(parseFilters('?p=0&perPage=x'), EMPTY)
  assert.equal(parseFilters('?perPage=5000').perPage, 1000)
})

test('the order lives in the address as Stash writes it', () => {
  const sort = (search) => {
    const { sortBy, sortDir, seed } = parseFilters(search)
    return [sortBy, sortDir, seed]
  }
  // Newest first is the default and leaves the address alone
  assert.deepEqual(sort(''), ['date', 'desc', null])
  assert.equal(formatFilters({ ...EMPTY }), '')
  assert.equal(
    formatFilters({ ...EMPTY, sortDir: 'asc' }),
    '?sortby=date&sortdir=asc',
  )
  // Stash's rule: no sortdir is ascending, except for the date
  assert.deepEqual(sort('?sortby=title'), ['title', 'asc', null])
  assert.deepEqual(sort('?sortby=date'), ['date', 'desc', null])
  assert.deepEqual(sort('?sortby=duration&sortdir=desc'), [
    'duration',
    'desc',
    null,
  ])
  // Random carries its seed in sortby
  assert.deepEqual(sort('?sortby=random_12345678&sortdir=asc'), [
    'random',
    'asc',
    12345678,
  ])
  assert.equal(
    formatFilters({ ...EMPTY, sortBy: 'random', sortDir: 'asc', seed: 42 }),
    '?sortby=random_42&sortdir=asc',
  )
  // A sort the page does not offer is the default one
  assert.deepEqual(sort('?sortby=o_counter'), ['date', 'desc', null])
})

// Releases as sort() sees them, with what each sort compares
const rel = (key, f = {}) => ({
  key,
  title: key,
  date: '2026-10-18',
  found: null,
  duration: null,
  studio: { name: 'Studio' },
  performers: [],
  tags: [],
  ...f,
})
const keys = (list) => list.map((r) => r.key)

test('sorts as Stash names them, listed by name, plus Found', () => {
  assert.deepEqual(
    SORTS.map((s) => s.label),
    [
      'Date',
      'Duration',
      'Found',
      'Performer Count',
      'Random',
      'Studio',
      'Tag Count',
      'Title',
    ],
  )
  const list = [
    rel('a', {
      title: 'Apple 10',
      date: '2026-10-17',
      duration: 600,
      found: '2026-10-19T08:00:00Z',
      studio: { name: 'Zebra' },
      performers: [{}],
      tags: [{}, {}, {}],
    }),
    rel('b', {
      title: 'apple 9',
      date: '2026-10-19',
      duration: 1200,
      found: '2026-10-18T08:00:00Z',
      studio: { name: 'Mango' },
      performers: [{}, {}, {}],
      tags: [{}],
    }),
    rel('c', {
      title: 'Cherry',
      date: '2026-10-18',
      duration: 900,
      found: '2026-10-20T08:00:00Z',
      studio: { name: 'apple' },
      performers: [{}, {}],
      tags: [{}, {}],
    }),
  ]
  const by = (sortBy, sortDir = 'asc') =>
    keys(sortReleases(list, { sortBy, sortDir, seed: null }))
  assert.deepEqual(by('date', 'desc'), ['b', 'c', 'a'])
  assert.deepEqual(by('date'), ['a', 'c', 'b'])
  assert.deepEqual(by('duration'), ['a', 'c', 'b'])
  assert.deepEqual(by('found', 'desc'), ['c', 'a', 'b'])
  assert.deepEqual(by('performer_count'), ['a', 'c', 'b'])
  assert.deepEqual(by('tag_count', 'desc'), ['a', 'c', 'b'])
  // Names by Stash's natural order: case aside, 9 before 10
  assert.deepEqual(by('studio'), ['c', 'b', 'a'])
  assert.deepEqual(by('title'), ['b', 'a', 'c'])
  assert.deepEqual(by('title', 'desc'), ['c', 'a', 'b'])
})

test('ties go newest first, then by title; nothing to sort by goes last', () => {
  const list = [
    rel('old', { date: '2026-10-17', duration: 300 }),
    rel('none-b', { title: 'B', date: '2026-10-19' }),
    rel('new', { date: '2026-10-19', duration: 300 }),
    rel('none-a', { title: 'A', date: '2026-10-18' }),
  ]
  for (const sortDir of ['asc', 'desc'])
    assert.deepEqual(
      keys(sortReleases(list, { sortBy: 'duration', sortDir })),
      ['new', 'old', 'none-b', 'none-a'],
    )
  // Found before the plugin kept it: last either way
  const found = [
    rel('kept'),
    rel('later', { found: '2026-10-20T00:00:00Z' }),
    rel('sooner', { found: '2026-10-19T00:00:00Z' }),
  ]
  assert.deepEqual(
    keys(sortReleases(found, { sortBy: 'found', sortDir: 'desc' })),
    ['later', 'sooner', 'kept'],
  )
  assert.deepEqual(
    keys(sortReleases(found, { sortBy: 'found', sortDir: 'asc' })),
    ['sooner', 'later', 'kept'],
  )
  assert.equal(newestFirst(rel('x'), rel('x')), 0)
})

test('random holds its order for a seed and shuffles for another', () => {
  const list = Array.from({ length: 30 }, (_, i) => rel(`k${i}`))
  const order = (seed, sortDir = 'asc') =>
    keys(sortReleases(list, { sortBy: 'random', sortDir, seed }))
  assert.deepEqual(order(1234), order(1234))
  assert.notDeepEqual(order(1234), order(5678))
  assert.notDeepEqual(order(1234), keys(list))
  assert.deepEqual(order(1234, 'desc'), [...order(1234)].reverse())
  assert.deepEqual([...order(1234)].sort(), [...keys(list)].sort())
})

test('New: found by its studio’s latest check when the page opened, or since; never by a studio’s first check', () => {
  const since = newSince({
    run: { started: '2026-10-20T09:00:00Z' },
    studios: {
      1: { asked: '2026-10-20T10:00:00Z' },
      // Asked before the plugin kept the time
      2: { checked: '2026-10-20T09:05:00Z' },
    },
  })
  const at = (studio, found, first) =>
    isNew(rel('a', { studio: { id: studio }, found, first }), since)
  assert.equal(at('1', '2026-10-20T10:00:00Z'), true)
  assert.equal(at('1', '2026-10-20T10:30:00Z'), true)
  assert.equal(at('1', '2026-10-19T10:00:00Z'), false)
  // Another studio's check does not end this one's New
  assert.equal(at('2', '2026-10-20T09:01:00Z'), true)
  assert.equal(at('2', '2026-10-20T08:59:00Z'), false)
  // A studio's first check, and releases found before the plugin kept it
  assert.equal(at('1', '2026-10-20T10:30:00Z', true), false)
  assert.equal(at('1', null), false)
  // No catalog when the page opened
  assert.equal(
    isNew(
      rel('a', { studio: { id: '1' }, found: '2026-10-20T10:30:00Z' }),
      newSince(null),
    ),
    false,
  )
})

test('filters: any of the studios and performers, all of the tags, none left out, none you have', () => {
  const list = present()
  const titles = (f) =>
    applyFilters(list, { ...EMPTY, ...f }).map((r) => r.title)
  // Older and Newest are held by scenes of yours
  assert.deepEqual(titles({}), ['Box one'])
  const all = list.map((r) => ({ ...r, owner: null }))
  const anyOwner = (f) =>
    applyFilters(all, { ...EMPTY, ...f }).map((r) => r.title)
  assert.deepEqual(anyOwner({}), ['Newest', 'Box one', 'Older'])
  assert.deepEqual(anyOwner({ studios: ['2'] }), ['Box one'])
  assert.deepEqual(anyOwner({ performers: [{ key: '20' }, { key: '21' }] }), [
    'Newest',
    'Older',
  ])
  assert.deepEqual(anyOwner({ performers: [{ key: '20', exclude: true }] }), [
    'Newest',
    'Box one',
  ])
  assert.deepEqual(anyOwner({ tags: [{ key: '11' }, { key: '10' }] }), [
    'Box one',
  ])
  assert.deepEqual(anyOwner({ tags: [{ key: '11', exclude: true }] }), [
    'Older',
  ])
})

test('a page of the list, past the last page showing the last', () => {
  const list = Array.from({ length: 45 }, (_, i) => i)
  assert.deepEqual(pageOf(list, { page: 1, perPage: 20 }).items.length, 20)
  const third = pageOf(list, { page: 3, perPage: 20 })
  assert.deepEqual(
    [third.items, third.page, third.pages],
    [[40, 41, 42, 43, 44], 3, 3],
  )
  assert.equal(pageOf(list, { page: 9, perPage: 20 }).page, 3)
  assert.deepEqual(pageOf([], { page: 2, perPage: 20 }), {
    items: [],
    page: 1,
    pages: 1,
  })
})

test('the list keeps what the page opened with; what arrives after goes to Just in, newest first', () => {
  const opened = new Set(['a', 'b'])
  const first = splitArrivals([rel('b'), rel('a')], opened)
  assert.deepEqual(keys(first.list), ['b', 'a'])
  assert.deepEqual(first.justIn, [])
  // Two arrive together: newest release first between them
  const next = splitArrivals(
    [
      rel('a'),
      rel('c', { date: '2026-10-18' }),
      rel('b'),
      rel('d', { date: '2026-10-19' }),
    ],
    opened,
    first.arrived,
  )
  assert.deepEqual(keys(next.list), ['a', 'b'])
  assert.deepEqual(keys(next.justIn), ['d', 'c'])
  // A later arrival goes in front, and the earlier ones keep their places
  const after = splitArrivals(
    [
      rel('c', { date: '2026-10-18' }),
      rel('e', { date: '2026-10-01' }),
      rel('d', { date: '2026-10-19' }),
      rel('a'),
      rel('b'),
    ],
    opened,
    next.arrived,
  )
  assert.deepEqual(keys(after.justIn), ['e', 'd', 'c'])
  // A page that opened with nothing takes everything into its list
  const empty = splitArrivals([rel('a'), rel('b')], null)
  assert.deepEqual(keys(empty.list), ['a', 'b'])
  assert.deepEqual(empty.justIn, [])
})

test('the page looks up who holds the releases a save added, whatever its stamp says', () => {
  const tpdb = (id) => releaseKey({ endpoint: TPDB, id })
  const box = (id) => releaseKey({ endpoint: BOX, id })
  const opened = { saved: '2026-10-20T15:35:00Z', releases: catalog.releases }
  const covered = new Set([tpdb('a'), tpdb('b'), box('c'), box('d')])
  assert.equal(uncovered(opened, covered), '')
  // A check saved within the same second: same stamp, one release more
  const next = {
    ...opened,
    releases: [...catalog.releases, { id: 'e', endpoint: TPDB }],
  }
  assert.equal(uncovered(next, covered), tpdb('e'))
  // A release with no StashID has nothing to look up
  assert.equal(uncovered({ releases: [{ id: 'f' }] }, covered), '')
  assert.equal(uncovered(null, covered), '')
})

test('the filter options count the releases you do not have, most first', () => {
  const all = present().map((r) => ({ ...r, owner: null }))
  assert.deepEqual(
    optionsOf(all, 'tags').map((o) => [o.name, o.count]),
    [
      ['Candy', 2],
      ['Glossy', 2],
      ['Fizz', 1],
    ],
  )
  // Older and Newest are yours
  assert.deepEqual(
    optionsOf(present(), 'tags').map((o) => [o.name, o.count]),
    [
      ['Candy', 1],
      ['Glossy', 1],
    ],
  )
})

test('a release carries its description', () => {
  assert.equal(present()[0].description, 'The newest one.')
  assert.equal(present()[1].description, null)
})

test('a release carries when a check found it, and whether that was its studio’s first', () => {
  const stamped = {
    releases: [
      { ...catalog.releases[1], found: '2026-10-20T10:00:00Z', first: true },
      { ...catalog.releases[2] },
    ],
  }
  const [newest, box] = presentReleases(stamped, {
    studios,
    tags,
    performers,
    owned,
  })
  assert.deepEqual(
    [newest.found, newest.first, box.found, box.first],
    ['2026-10-20T10:00:00Z', true, null, false],
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

test('the page starts a check when the catalog is missing, older, a day old, unfinished or missing a new favourite', () => {
  const now = Date.parse('2026-10-19T12:00:00Z')
  const linked = [{ id: '1' }, { id: '2' }]
  const run = (
    finished,
    favourites = ['1', '2'],
    version = CATALOG_VERSION,
  ) => ({
    version,
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
  // A catalog from an earlier version of the plugin
  assert.equal(
    shouldStart({ catalog: run(recent, ['1', '2'], 1), linked, now }),
    true,
  )
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
  // The page and the task agree on the catalog's version
  const task = await readFile(
    new URL('../../src/py/newreleases.py', import.meta.url),
    'utf8',
  )
  assert.equal(
    Number(/^CATALOG_VERSION = (\d+)$/m.exec(task)[1]),
    CATALOG_VERSION,
  )
})
