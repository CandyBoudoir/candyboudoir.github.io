// The Python task (src/py/newreleases.py), run as Stash runs it: the plugin
// folder's script with Stash's JSON on stdin, against a stand-in for Stash's
// GraphQL API, the ThePornDB mock (tests/stash/theporndb.mjs) and a
// stash-box answering from the invented StashDB catalogue. No request
// leaves this machine. Skipped where there is no python3.
import { test, before, after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  utimes,
  mkdir,
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STASHDB } from '../../../../tests/stash/stashbox-data.mjs'
import {
  TPDB_SCENES,
  TPDB_SITES,
  TPDB_UNKNOWN,
  handleTpdb,
} from '../../../../tests/stash/theporndb.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', '..', 'src')

// Importing the script from src/ must leave no __pycache__ there.
const NO_PYC = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }

const hasPython = (() => {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

let server
let base
let dir
// What the Stash stand-in answers, set by each test
let stash
const boxRequests = []
const stashRequests = []

const json = (res, body) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const readBody = (req) =>
  new Promise((done) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => done(raw ? JSON.parse(raw) : {}))
  })

// A stash-box answering queryScenes from the StashDB catalogue: scenes of
// any of the studios asked for, newest first.
function boxScenes(input) {
  const ids = new Set(input?.studios?.value || [])
  return STASHDB.scenes
    .filter((s) => ids.has(s.studio?.id))
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .slice(0, input?.per_page ?? 25)
    .map(({ popularity, ...s }) => (void popularity, s))
}

before(async () => {
  server = createServer(async (req, res) => {
    if (handleTpdb(req, res, { delay: 5 })) return
    const { pathname } = new URL(req.url, 'http://x')
    if (pathname === '/graphql') {
      stashRequests.push({
        cookie: req.headers.cookie,
        body: await readBody(req),
      })
      return json(res, {
        data: {
          configuration: {
            general: { stashBoxes: stash.boxes },
            plugins: { NewReleases: stash.settings },
          },
          findStudios: { studios: stash.favourites },
        },
      })
    }
    if (pathname === '/box/graphql') {
      const body = await readBody(req)
      boxRequests.push({
        apiKey: req.headers.apikey,
        userAgent: req.headers['user-agent'],
        variables: body.variables,
        start: Date.now(),
      })
      if (/^invalid/.test(req.headers.apikey || ''))
        return json(res, {
          errors: [{ message: 'token signature is invalid' }],
        })
      return json(res, {
        data: { queryScenes: { scenes: boxScenes(body.variables?.input) } },
      })
    }
    res.writeHead(404).end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((r) => server.close(r)))

const TPDB = () => ({
  name: 'ThePornDB',
  endpoint: `${base}/tpdb/graphql`,
  api_key: 'tpdb-key',
})
const BOX = () => ({
  name: 'CandyDB',
  endpoint: `${base}/box/graphql`,
  api_key: 'box-key',
})
const SETTINGS = () => ({
  tpdbEndpoint: `${base}/tpdb/graphql`,
  tpdbApi: `${base}/tpdb`,
  pauseSeconds: 0.05,
})

const studio = (id, name, links) => ({
  id: String(id),
  name,
  stash_ids: links.map(([endpoint, stash_id]) => ({ endpoint, stash_id })),
})

// The demo favourites: two ThePornDB sites (one also on the stash-box, which
// loses to ThePornDB), one asked weekly, one ThePornDB does not know, two on
// the stash-box only and one linked nowhere.
function favourites() {
  const t = `${base}/tpdb/graphql`
  const b = `${base}/box/graphql`
  return [
    studio(1, 'Lollipop Lounge', [[t, TPDB_SITES.lollipop.uuid]]),
    studio(2, 'Gumball Gallery', [
      [b, 'sdb-st-fudge'],
      [t, TPDB_SITES.gumball.uuid],
    ]),
    studio(3, 'Sleepy Sweets', [[t, TPDB_SITES.sleepy.uuid]]),
    studio(4, 'Nowhere Nougat', [[t, TPDB_UNKNOWN]]),
    studio(5, 'Fudge Factory', [[b, 'sdb-st-fudge']]),
    studio(6, 'Toffee Lane', [[b, 'sdb-st-toffee']]),
    studio(7, 'Unlinked Licorice', []),
  ]
}

const clearTpdb = () => fetch(`${base}/tpdb/_requests`, { method: 'DELETE' })
const tpdbLog = async () => (await fetch(`${base}/tpdb/_requests`)).json()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'newreleases-'))
  // The plugin folder as Stash installs it: the script beside the manifest
  await cp(join(SRC, 'py', 'newreleases.py'), join(dir, 'newreleases.py'))
  await cp(join(SRC, 'NewReleases.yml'), join(dir, 'NewReleases.yml'))
  stash = {
    boxes: [TPDB(), BOX()],
    settings: SETTINGS(),
    favourites: favourites(),
  }
  boxRequests.length = 0
  stashRequests.length = 0
  await clearTpdb()
})

// Runs the task once, as Stash does, and returns its stdout answer.
function runTask(mode = 'refresh') {
  const port = Number(new URL(base).port)
  const input = {
    server_connection: {
      Scheme: 'http',
      Host: '0.0.0.0',
      Port: port,
      SessionCookie: { Name: 'session', Value: 'cookie-value' },
      Dir: dir,
      PluginDir: dir,
    },
    args: { mode },
  }
  return new Promise((done, fail) => {
    const child = spawn('python3', [join(dir, 'newreleases.py')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (c) => (out += c))
    child.stderr.on('data', (c) => (err += c))
    child.on('error', fail)
    child.on('exit', (code) => {
      if (code !== 0) return fail(new Error(`exit ${code}: ${err}`))
      done({ answer: JSON.parse(out), log: err })
    })
    child.stdin.end(JSON.stringify(input))
  })
}

const catalogFile = () => join(dir, 'catalog', 'catalog.json')
const readCatalog = async () =>
  JSON.parse(await readFile(catalogFile(), 'utf8'))
const releasesOf = (catalog, id) =>
  catalog.releases.filter((r) => r.studio === String(id))

// Moves every check back by `hours`, as if that long had passed.
async function age(hours) {
  const catalog = await readCatalog()
  const back = (iso) =>
    new Date(Date.parse(iso) - hours * 3600_000)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z')
  for (const s of Object.values(catalog.studios))
    if (s.checked) s.checked = back(s.checked)
  catalog.run.finished = back(catalog.run.finished)
  await writeFile(catalogFile(), JSON.stringify(catalog))
}

test(
  'a first check fills the catalog from ThePornDB and the stash-box',
  { skip: !hasPython },
  async () => {
    const { answer } = await runTask()
    assert.equal(answer.error, null)
    const catalog = await readCatalog()
    assert.equal(catalog.version, 1)
    assert.equal(catalog.run.state, 'done')
    assert.deepEqual(catalog.run.favourites, [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ])

    // ThePornDB's sites, with their numeric ids kept for next time
    assert.equal(catalog.studios['1'].siteId, TPDB_SITES.lollipop.id)
    assert.equal(
      releasesOf(catalog, 1).length,
      TPDB_SCENES[TPDB_SITES.lollipop.id].length,
    )
    // Linked to both, Gumball Gallery comes from ThePornDB
    assert.equal(catalog.studios['2'].endpoint, `${base}/tpdb/graphql`)
    assert.equal(
      releasesOf(catalog, 2).length,
      TPDB_SCENES[TPDB_SITES.gumball.id].length,
    )
    // An unknown site is noted and asked again in a week
    assert.match(catalog.studios['4'].error, /^not found on ThePornDB/)
    assert.equal(catalog.studios['4'].quiet, true)
    // Years without a release: weekly
    assert.equal(catalog.studios['3'].quiet, true)
    assert.equal(catalog.studios['1'].quiet, false)
    // Linked nowhere: listed, never asked about
    assert.equal(catalog.studios['7'].endpoint, undefined)
    assert.equal(catalog.studios['7'].checked, undefined)

    const lullaby = releasesOf(catalog, 1).find(
      (r) => r.title === 'Lollipop Lullaby',
    )
    const source = TPDB_SCENES[TPDB_SITES.lollipop.id][0]
    assert.equal(lullaby.id, source.id)
    assert.equal(lullaby.endpoint, `${base}/tpdb/graphql`)
    assert.equal(lullaby.date, source.date)
    assert.equal(lullaby.duration, 734)
    // The studio's own page, without the tracking parameters
    assert.equal(
      lullaby.url,
      'https://lollipop-lounge.example/clips/lollipop-lullaby',
    )
    assert.equal(lullaby.image, source.posters.medium)
    assert.deepEqual(
      lullaby.performers.map((p) => [p.id, p.name]),
      source.performers.map((p) => [p.parent.id, p.name]),
    )
    assert.deepEqual(
      lullaby.tags.map((t) => [t.id, t.name]),
      source.tags.map((t) => [t.uuid, t.name]),
    )
    // A performer credited under another name keeps ThePornDB's name too
    const cordial = releasesOf(catalog, 1).find(
      (r) => r.title === 'Cherry Cordial',
    )
    assert.deepEqual(cordial.performers[0].also, ['Bonbon Bijou'])

    // The stash-box's studios in one request, newest first, with store links
    // cleaned and studio links for the rest
    assert.equal(boxRequests.length, 1)
    assert.deepEqual(boxRequests[0].variables.input, {
      studios: {
        value: ['sdb-st-fudge', 'sdb-st-toffee'],
        modifier: 'INCLUDES',
      },
      sort: 'DATE',
      direction: 'DESC',
      page: 1,
      per_page: 100,
    })
    assert.equal(boxRequests[0].apiKey, 'box-key')
    const toffee = releasesOf(catalog, 6)
    const fudge = releasesOf(catalog, 5)
    assert.equal(
      toffee.length + fudge.length,
      STASHDB.scenes.filter((s) =>
        ['sdb-st-fudge', 'sdb-st-toffee'].includes(s.studio.id),
      ).length,
    )
    assert.ok(
      toffee.every((r) =>
        /^https:\/\/clips\.example\/clip\/[\w-]+$/.test(r.url),
      ),
    )
    assert.ok(
      fudge.every((r) =>
        /^https:\/\/example\.com\/scenes\/[\w-]+$/.test(r.url),
      ),
    )
    assert.ok(fudge.every((r) => r.image && r.date && r.performers.length))
  },
)

test(
  "it asks politely: one request at a time, paced, with its name and the user's key",
  { skip: !hasPython },
  async () => {
    await runTask()
    const { requests, maxInFlight } = await tpdbLog()
    assert.equal(maxInFlight, 1)
    // Each studio's site once, then its scenes, with the same parameters on
    // every install
    assert.deepEqual(
      requests.map((r) => `${r.path}${r.query}`),
      [
        `/sites/${TPDB_SITES.lollipop.uuid}`,
        `/scenes?site_id=${TPDB_SITES.lollipop.id}&per_page=25&orderBy=recently_released`,
        `/sites/${TPDB_SITES.gumball.uuid}`,
        `/scenes?site_id=${TPDB_SITES.gumball.id}&per_page=25&orderBy=recently_released`,
        `/sites/${TPDB_SITES.sleepy.uuid}`,
        `/scenes?site_id=${TPDB_SITES.sleepy.id}&per_page=25&orderBy=recently_released`,
        `/sites/${TPDB_UNKNOWN}`,
      ],
    )
    for (const r of requests) {
      assert.equal(r.authorization, 'Bearer tpdb-key')
      assert.match(
        r.userAgent,
        /^NewReleases\/0\.1\.0 \(Stash plugin; \+https:\/\/github\.com\/CandyBoudoir\/candyboudoir\.github\.io\/tree\/main\/plugins\/newreleases\)$/,
      )
    }
    for (let i = 1; i < requests.length; i++)
      assert.ok(
        requests[i].start - requests[i - 1].end >= 40,
        `request ${i} waited ${requests[i].start - requests[i - 1].end} ms`,
      )
    assert.match(boxRequests[0].userAgent, /^NewReleases\/0\.1\.0 /)
    // Stash with the session cookie Stash handed the task, at 127.0.0.1 for 0.0.0.0
    assert.equal(stashRequests[0].cookie, 'session=cookie-value')
  },
)

test(
  'a check the next hour asks nothing; a day later only the daily studios, from their kept site ids',
  { skip: !hasPython },
  async () => {
    await runTask()
    await clearTpdb()
    boxRequests.length = 0
    await runTask()
    assert.deepEqual((await tpdbLog()).requests, [])
    assert.equal(boxRequests.length, 0)

    await age(21)
    await runTask()
    assert.deepEqual(
      (await tpdbLog()).requests.map((r) => `${r.path}${r.query}`),
      [
        `/scenes?site_id=${TPDB_SITES.lollipop.id}&per_page=25&orderBy=recently_released`,
        `/scenes?site_id=${TPDB_SITES.gumball.id}&per_page=25&orderBy=recently_released`,
      ],
    )
    assert.equal(boxRequests.length, 1)

    // A week on, the quiet ones too
    await clearTpdb()
    await age(24 * 7)
    await runTask()
    assert.equal((await tpdbLog()).requests.length, 4)
  },
)

for (const [site, why] of [
  ['slowDown', /429/],
  ['down', /503/],
  ['challenge', /Cloudflare challenge/],
])
  test(
    `a ${why.source} answer stops asking ThePornDB until the next day`,
    { skip: !hasPython },
    async () => {
      const t = `${base}/tpdb/graphql`
      stash.favourites = [
        studio(1, 'Trouble', [[t, TPDB_SITES[site].uuid]]),
        studio(2, 'Lollipop Lounge', [[t, TPDB_SITES.lollipop.uuid]]),
        studio(5, 'Fudge Factory', [[`${base}/box/graphql`, 'sdb-st-fudge']]),
      ]
      await runTask()
      const { requests } = await tpdbLog()
      // The site, its scenes, and nothing after
      assert.equal(requests.length, 2)
      assert.equal(
        requests[1].query.includes(String(TPDB_SITES[site].id)),
        true,
      )
      const catalog = await readCatalog()
      assert.equal(catalog.run.state, 'stopped')
      const box = catalog.boxes[t]
      assert.match(box.error, why)
      const hours = (Date.parse(box.pausedUntil) - Date.now()) / 3600_000
      assert.ok(hours > 19 && hours <= 20, `paused for ${hours} hours`)
      // The other stash-box still answers
      assert.equal(boxRequests.length, 1)
      assert.equal(catalog.studios['2'].checked, undefined)

      // Asked again at once: still nothing to ThePornDB
      await clearTpdb()
      await age(21)
      const after = await readCatalog()
      after.boxes[t].pausedUntil = box.pausedUntil
      await writeFile(catalogFile(), JSON.stringify(after))
      await runTask()
      assert.equal((await tpdbLog()).requests.length, 0)
    },
  )

test(
  'a refused key stops asking that stash-box and says so',
  { skip: !hasPython },
  async () => {
    stash.boxes = [
      { ...TPDB(), api_key: 'invalid-key' },
      { ...BOX(), api_key: 'invalid-too' },
    ]
    await runTask()
    assert.equal((await tpdbLog()).requests.length, 1)
    const catalog = await readCatalog()
    assert.match(
      catalog.boxes[`${base}/tpdb/graphql`].error,
      /^refused the API key/,
    )
    assert.match(
      catalog.boxes[`${base}/box/graphql`].error,
      /^refused the API key/,
    )
    assert.equal(catalog.releases.length, 0)
  },
)

test(
  'a stash-box with no key is never asked',
  { skip: !hasPython },
  async () => {
    stash.boxes = [{ ...TPDB(), api_key: '' }, BOX()]
    await runTask()
    assert.equal((await tpdbLog()).requests.length, 0)
    const catalog = await readCatalog()
    assert.equal(catalog.boxes[`${base}/tpdb/graphql`].error, 'no API key')
    assert.equal(boxRequests.length, 1)
  },
)

test(
  'studios no longer favourited leave the catalog',
  { skip: !hasPython },
  async () => {
    await runTask()
    stash.favourites = stash.favourites.filter((s) => s.id !== '1')
    await runTask()
    const catalog = await readCatalog()
    assert.equal(catalog.studios['1'], undefined)
    assert.equal(releasesOf(catalog, 1).length, 0)
    assert.ok(releasesOf(catalog, 2).length)
  },
)

test(
  'a second check while one runs does nothing; an old lock is taken over',
  { skip: !hasPython },
  async () => {
    await mkdir(join(dir, 'catalog'), { recursive: true })
    const lock = join(dir, 'catalog', 'run.lock')
    await writeFile(lock, '1 now\n')
    const { answer } = await runTask()
    assert.equal(answer.output, 'already running')
    assert.equal((await tpdbLog()).requests.length, 0)
    const old = new Date(Date.now() - 3 * 3600_000)
    await utimes(lock, old, old)
    await runTask()
    assert.ok((await tpdbLog()).requests.length > 0)
    assert.equal(existsSync(lock), false)
  },
)

test(
  'Remove the catalog deletes it and its folder',
  { skip: !hasPython },
  async () => {
    await runTask()
    assert.ok(existsSync(catalogFile()))
    await runTask('remove')
    assert.equal(existsSync(join(dir, 'catalog')), false)
  },
)

// The settings the tests use never apply to a real service: ThePornDB's own
// endpoint keeps its API and full pause whatever they say.
test(
  'the test settings apply only on this machine',
  { skip: !hasPython },
  async () => {
    const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(join(SRC, 'py'))})
import newreleases as n
settings = {'tpdbEndpoint': 'https://theporndb.net/graphql', 'tpdbApi': 'https://elsewhere.example', 'pauseSeconds': 0}
boxes = [
  {'name': 'ThePornDB', 'endpoint': 'https://theporndb.net/graphql', 'api_key': 'k'},
  {'name': 'StashDB', 'endpoint': 'https://stashdb.org/graphql', 'api_key': 'k', 'max_requests_per_minute': 10},
  {'name': 'Mock', 'endpoint': 'http://127.0.0.1:1/graphql', 'api_key': 'k'},
]
print(json.dumps([[s.kind, s.address(), s.pause] for s in n.services_for(boxes, settings)]))
`
    const out = JSON.parse(
      execFileSync('python3', ['-c', script], { env: NO_PYC }).toString(),
    )
    assert.deepEqual(out, [
      ['tpdb', 'https://api.theporndb.net', 3],
      ['stashbox', 'https://stashdb.org/graphql', 6],
      ['stashbox', 'http://127.0.0.1:1/graphql', 0],
    ])
  },
)

test(
  'links keep the page and drop tracking, archives and odd schemes',
  { skip: !hasPython },
  async () => {
    const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(join(SRC, 'py'))})
import newreleases as n
print(json.dumps([
  n.clean_url('https://shop.example/clip/1?utm_source=x&aff=2&id=9#top'),
  n.clean_url('https://web.archive.org/web/2025/https://shop.example/clip/1'),
  n.clean_url('javascript:alert(1)'),
  n.store_link([
    {'url': 'https://studio.example/s/1?nats=abc', 'site': {'name': 'Studio'}},
    {'url': 'https://clips.example/c/1?ref=x', 'site': {'name': 'Clips', 'category': {'name': 'Content distribution platforms'}}},
  ]),
  n.store_link([{'url': 'https://studio.example/s/2', 'type': 'STUDIO'}]),
  n.store_link([{'url': 'https://fan.example/x', 'site': {'name': 'Fan site'}}]),
]))
`
    const out = JSON.parse(
      execFileSync('python3', ['-c', script], { env: NO_PYC }).toString(),
    )
    assert.deepEqual(out, [
      'https://shop.example/clip/1?id=9',
      null,
      null,
      'https://clips.example/c/1',
      'https://studio.example/s/2',
      null,
    ])
  },
)

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})
