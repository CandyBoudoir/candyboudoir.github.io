// New Releases' test helpers, on top of the ones every plugin shares. The
// specs add a demo of their own to the shared test Stash and take it away
// after: favourite studios linked to the mock ThePornDB (theporndb.mjs) and
// to the mock stash-box's StashDB catalogue (whose scenes are too old for
// the 48-hour window, so it answers with nothing kept), one linked nowhere,
// two scenes that already hold releases, and performers to name them. The mock
// ThePornDB is registered as a second stash-box only while they run, so
// the themes' stash-box screenshots never see it.
import { readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  gql,
  setPluginSettings,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'
import { ENDPOINT } from '../../../tests/stash/stashbox-data.mjs'
import {
  TPDB_API,
  TPDB_ENDPOINT,
  TPDB_LATE,
  TPDB_NAME,
  TPDB_SCENES,
  TPDB_SITES,
  TPDB_STASH_BOX,
  tpdbFresh,
} from '../../../tests/stash/theporndb.mjs'

export * from '../../../tests/stash/helpers.mjs'
export {
  TPDB_API,
  TPDB_ENDPOINT,
  TPDB_LATE,
  TPDB_SCENES,
  TPDB_SITES,
  TPDB_STASH_BOX,
  tpdbFresh,
} from '../../../tests/stash/theporndb.mjs'

export const PLUGIN_ID = 'NewReleases'

// The undeclared settings that point the task at the mock ThePornDB and
// shorten its pause, honoured only for services on this machine
export const TEST_SETTINGS = {
  tpdbEndpoint: TPDB_ENDPOINT,
  tpdbApi: TPDB_API,
  pauseSeconds: 0.5,
}
export const ROUTE = '/plugins/newreleases'
export const CHECK = 'Check for new releases'

// Marks what the demo adds, so tearing it down removes nothing else.
const MARK = "Added by New Releases' tests."

export const DEMO_STUDIOS = [
  ['Lollipop Lounge', [[TPDB_ENDPOINT, TPDB_SITES.lollipop.uuid]]],
  ['Gumball Gallery', [[TPDB_ENDPOINT, TPDB_SITES.gumball.uuid]]],
  ['Sleepy Sweets', [[TPDB_ENDPOINT, TPDB_SITES.sleepy.uuid]]],
  ['Fudge Factory', [[ENDPOINT, 'sdb-st-fudge']]],
  ['Toffee Lane', [[ENDPOINT, 'sdb-st-toffee']]],
  ['Mystery Mints', []],
]

// Performers the user has: one by its StashID on the stash-box, one by name.
// The shared library's Gumdrop Gigi and Bonbon Bijou match by name, Bijou
// by the name ThePornDB files her credit under.
const DEMO_PERFORMERS = [
  ['Caramel Coco', [[ENDPOINT, 'sdb-p-coco']]],
  ['Peppermint Patti', []],
]

// The releases the demo's scenes hold, both inside the 48-hour window: one
// by its ThePornDB StashID, one by the address of its studio's page.
export const HELD_BY_ID = TPDB_SCENES[TPDB_SITES.lollipop.id][1]
export const HELD_BY_URL = TPDB_SCENES[TPDB_SITES.gumball.id][1]
export const heldUrl = (scene) => scene.url.replace(/\?.*$/, '')

// The releases the page shows the demo: the last 48 hours' from ThePornDB,
// less the two held
export const SHOWN = [
  ...tpdbFresh(TPDB_SITES.lollipop),
  ...tpdbFresh(TPDB_SITES.gumball),
].filter((s) => s !== HELD_BY_ID && s !== HELD_BY_URL)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const stashIds = (links) =>
  links.map(([endpoint, stash_id]) => ({ endpoint, stash_id }))

async function boxes() {
  const { configuration } = await gql(
    '{ configuration { general { stashBoxes { name endpoint api_key } } } }',
  )
  return configuration.general.stashBoxes
}

export const setBoxes = (list) =>
  gql(
    `mutation ($b: [StashBoxInput!]) {
      configureGeneral(input: { stashBoxes: $b }) { stashBoxes { endpoint } } }`,
    { b: list },
  )

// The shared library's stash-boxes, without the mock ThePornDB.
async function sharedBoxes() {
  return (await boxes())
    .filter((b) => b.endpoint !== TPDB_ENDPOINT)
    .map(({ name, endpoint, api_key }) => ({ name, endpoint, api_key }))
}

// Runs a task of the plugin's and waits for its job to end.
export async function runTask(name, timeout = 60_000) {
  const { runPluginTask: id } = await gql(
    'mutation ($t: String!) { runPluginTask(plugin_id: "NewReleases", task_name: $t) }',
    { t: name },
  )
  return waitForJob(id, timeout)
}

export async function waitForJob(id, timeout = 60_000) {
  for (const end = Date.now() + timeout; Date.now() < end;) {
    const { findJob } = await gql(
      'query ($i: ID!) { findJob(input: { id: $i }) { status error } }',
      { i: id },
    )
    if (
      !findJob ||
      ['FINISHED', 'FAILED', 'CANCELLED'].includes(findJob.status)
    )
      return findJob
    await sleep(250)
  }
  throw new Error(`job ${id} did not finish`)
}

// The checks queued or running now.
export async function queuedChecks() {
  const { jobQueue } = await gql('{ jobQueue { id description } }')
  return (jobQueue || []).filter(
    (j) => j.description === `Running plugin task: ${CHECK}`,
  )
}

// A site's late release: ThePornDB lists it once published, as a release
// turns up between two checks.
export const lateRelease = (site) => TPDB_LATE[site.id]
export const publishLate = (site) =>
  fetch(`${TPDB_API}/_late?site_id=${site.id}`, { method: 'PUT' })
export const withdrawLate = () =>
  fetch(`${TPDB_API}/_late`, { method: 'DELETE' })

// The plugin's folder in the test Stash, which runs on this machine.
async function pluginDir() {
  const { configuration } = await gql(
    '{ configuration { general { pluginsPath } } }',
  )
  const root = configuration.general.pluginsPath
  const files = await readdir(root, { recursive: true })
  const manifest = files.find((f) => basename(f) === `${PLUGIN_ID}.yml`)
  if (!manifest) throw new Error(`no ${PLUGIN_ID}.yml under ${root}`)
  return join(root, dirname(manifest))
}

const earlier = (iso, hours) =>
  iso &&
  new Date(Date.parse(iso) - hours * 3600_000)
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')

/**
 * Moves the catalog's checks and finds back by `hours`, as if that long had
 * passed, so the page and the task find the studios due again.
 */
export async function ageCatalog(hours) {
  const file = join(await pluginDir(), 'catalog', 'catalog.json')
  const catalog = JSON.parse(await readFile(file, 'utf8'))
  catalog.run.started = earlier(catalog.run.started, hours)
  catalog.run.finished = earlier(catalog.run.finished, hours)
  for (const s of Object.values(catalog.studios))
    if (s.checked) s.checked = earlier(s.checked, hours)
  for (const r of catalog.releases)
    if (r.found) r.found = earlier(r.found, hours)
  await writeFile(`${file}.part`, JSON.stringify(catalog))
  await rename(`${file}.part`, file)
}

/**
 * Makes the page's first read of the catalog a day old and without
 * `releases`, so the page starts a check (which finds nothing due) and its
 * next read brings them in while the page is open, as a check's arrivals.
 */
export async function arriveWhileOpen(page, ...releases) {
  const ids = new Set(releases.map((r) => r.id))
  let first = true
  await page.route('**/assets/catalog/catalog.json', async (route) => {
    if (!first) return route.continue()
    first = false
    const response = await route.fetch()
    const catalog = await response.json()
    catalog.releases = catalog.releases.filter((r) => !ids.has(r.id))
    catalog.run.finished = earlier(catalog.run.finished, 21)
    await route.fulfill({ response, json: catalog })
  })
}

export const tpdbRequests = async () =>
  (await fetch(`${TPDB_API}/_requests`)).json()
export const clearTpdbRequests = () =>
  fetch(`${TPDB_API}/_requests`, { method: 'DELETE' })

async function removeDemo() {
  await withdrawLate()
  const { findScenes, findStudios, findPerformers } = await gql(`{
    findScenes(filter: { per_page: -1 }) { scenes { id details } }
    findStudios(filter: { per_page: -1 }) { studios { id details } }
    findPerformers(filter: { per_page: -1 }) { performers { id details } }
  }`)
  const mine = (list) => list.filter((x) => x.details === MARK).map((x) => x.id)
  const scenes = mine(findScenes.scenes)
  if (scenes.length)
    await gql(
      'mutation ($ids: [ID!]!) { scenesDestroy(input: { ids: $ids }) }',
      {
        ids: scenes,
      },
    )
  const performers = mine(findPerformers.performers)
  if (performers.length)
    await gql('mutation ($ids: [ID!]!) { performersDestroy(ids: $ids) }', {
      ids: performers,
    })
  const studios = mine(findStudios.studios)
  if (studios.length)
    await gql('mutation ($ids: [ID!]!) { studiosDestroy(ids: $ids) }', {
      ids: studios,
    })
}

/**
 * New Releases alone, with the demo, the mock ThePornDB as a stash-box, no
 * catalog and no check queued. Returns the demo studios' ids by name.
 */
export async function setUpNewReleases({ theme } = {}) {
  await usePlugins(PLUGIN_ID, ...(theme ? [theme] : []))
  await removeDemo()
  const shared = await sharedBoxes()
  await setBoxes([...shared, TPDB_STASH_BOX])
  await setPluginSettings(PLUGIN_ID, TEST_SETTINGS)
  const studios = {}
  for (const [name, links] of DEMO_STUDIOS) {
    const { studioCreate } = await gql(
      'mutation ($i: StudioCreateInput!) { studioCreate(input: $i) { id } }',
      {
        i: { name, favorite: true, details: MARK, stash_ids: stashIds(links) },
      },
    )
    studios[name] = studioCreate.id
  }
  for (const [name, links] of DEMO_PERFORMERS)
    await gql(
      'mutation ($i: PerformerCreateInput!) { performerCreate(input: $i) { id } }',
      { i: { name, details: MARK, stash_ids: stashIds(links) } },
    )
  await gql(
    'mutation ($i: SceneCreateInput!) { sceneCreate(input: $i) { id } }',
    {
      i: {
        title: HELD_BY_ID.title,
        details: MARK,
        stash_ids: [{ endpoint: TPDB_ENDPOINT, stash_id: HELD_BY_ID.id }],
      },
    },
  )
  await gql(
    'mutation ($i: SceneCreateInput!) { sceneCreate(input: $i) { id } }',
    {
      i: {
        title: HELD_BY_URL.title,
        details: MARK,
        studio_id: studios['Gumball Gallery'],
        urls: [heldUrl(HELD_BY_URL)],
      },
    },
  )
  await waitForChecks()
  await runTask('Remove the catalog')
  await clearTpdbRequests()
  return studios
}

export async function tearDownNewReleases() {
  await waitForChecks()
  await runTask('Remove the catalog')
  await removeDemo()
  await setBoxes(await sharedBoxes())
  await setPluginSettings(PLUGIN_ID, {})
  await usePlugins(PLUGIN_ID)
}

// Waits until no check is queued or running.
export async function waitForChecks(timeout = 60_000) {
  for (const end = Date.now() + timeout; Date.now() < end;) {
    if (!(await queuedChecks()).length) return
    await sleep(250)
  }
  throw new Error('a check did not finish')
}

// The page, once its first check has filled it in.
export async function openFilled(page, path = ROUTE) {
  await page.goto(path)
  await page.locator('.newreleases-card').first().waitFor({ timeout: 30_000 })
  await waitForChecks()
  await page.locator('.newreleases-status .LoadingIndicator').waitFor({
    state: 'detached',
    timeout: 15_000,
  })
}

export { TPDB_NAME }
