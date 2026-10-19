// New Releases' test helpers, on top of the ones every plugin shares. The
// specs add a demo of their own to the shared test Stash and take it away
// after: favourite studios linked to the mock ThePornDB (theporndb.mjs) and
// to the mock stash-box's StashDB catalogue, one linked nowhere, two scenes
// that already hold releases, and performers to name them. The mock
// ThePornDB is registered as a second stash-box only while they run, so
// the themes' stash-box screenshots never see it.
import {
  gql,
  setPluginSettings,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'
import { ENDPOINT, STASHDB } from '../../../tests/stash/stashbox-data.mjs'
import {
  TPDB_API,
  TPDB_ENDPOINT,
  TPDB_NAME,
  TPDB_SCENES,
  TPDB_SITES,
  TPDB_STASH_BOX,
} from '../../../tests/stash/theporndb.mjs'

export * from '../../../tests/stash/helpers.mjs'
export {
  TPDB_API,
  TPDB_ENDPOINT,
  TPDB_SCENES,
  TPDB_SITES,
  TPDB_STASH_BOX,
} from '../../../tests/stash/theporndb.mjs'

export const PLUGIN_ID = 'NewReleases'
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

// The releases the demo's scenes hold: one by its ThePornDB StashID, one
// by the address of its studio's page.
export const HELD_BY_ID = TPDB_SCENES[TPDB_SITES.lollipop.id][1]
export const HELD_BY_URL = STASHDB.scenes.find(
  (s) => s.studio.id === 'sdb-st-fudge',
)

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

export const tpdbRequests = async () =>
  (await fetch(`${TPDB_API}/_requests`)).json()
export const clearTpdbRequests = () =>
  fetch(`${TPDB_API}/_requests`, { method: 'DELETE' })

async function removeDemo() {
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
  await setPluginSettings(PLUGIN_ID, {
    tpdbEndpoint: TPDB_ENDPOINT,
    tpdbApi: TPDB_API,
    pauseSeconds: 0.5,
  })
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
        studio_id: studios['Fudge Factory'],
        urls: [`https://example.com/scenes/${HELD_BY_URL.id}`],
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
