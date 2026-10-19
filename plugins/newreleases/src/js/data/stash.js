// What the page reads from Stash, all through its GraphQL API: the
// stash-boxes and favourite studios, the user's tags and performers to name
// what the stash-boxes list, the scenes that already hold a release, and the
// job queue. The one thing it writes is the task it starts.
import { gql, mutate, query } from '../api.js'
import { CATALOG_URL, PLUGIN_ID, TASK_NAME } from '../name.js'
import { releaseKey } from './match.js'

const SETUP = gql`
  query NewReleasesSetup {
    configuration {
      general {
        stashBoxes {
          name
          endpoint
        }
      }
    }
    findStudios(
      studio_filter: { favorite: true }
      filter: { per_page: -1, sort: "name", direction: ASC }
    ) {
      studios {
        id
        name
        image_path
        stash_ids {
          endpoint
          stash_id
        }
      }
    }
  }
`

const JOBS = gql`
  query NewReleasesJobs {
    jobQueue {
      id
      status
      description
      progress
    }
  }
`

const JOB = gql`
  query NewReleasesJob($id: ID!) {
    findJob(input: { id: $id }) {
      id
      status
      error
    }
  }
`

const RUN = gql`
  mutation NewReleasesRun($plugin: ID!, $task: String!) {
    runPluginTask(plugin_id: $plugin, task_name: $task)
  }
`

const LIBRARY = gql`
  query NewReleasesLibrary($studios: [ID!], $any: Boolean!) {
    findTags(filter: { per_page: -1 }) {
      tags {
        id
        name
        aliases
        stash_ids {
          endpoint
          stash_id
        }
      }
    }
    findPerformers(filter: { per_page: -1 }) {
      performers {
        id
        name
        alias_list
        stash_ids {
          endpoint
          stash_id
        }
      }
    }
    findScenes(
      scene_filter: {
        studios: { value: $studios, modifier: INCLUDES, depth: -1 }
      }
      filter: { per_page: -1 }
    ) @include(if: $any) {
      scenes {
        id
        urls
        stash_ids {
          endpoint
          stash_id
        }
      }
    }
  }
`

export async function loadSetup() {
  const data = await query(SETUP)
  return {
    boxes: data.configuration.general.stashBoxes || [],
    favourites: data.findStudios.studios || [],
  }
}

// The catalog the task keeps, or null before its first check. The browser
// must not keep a copy: the task rewrites it as it goes.
export async function loadCatalog() {
  const res = await fetch(CATALOG_URL, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`the catalog did not load (HTTP ${res.status})`)
  return res.json()
}

const JOB_DESCRIPTION = `Running plugin task: ${TASK_NAME}`

// The check, when it is queued or running.
export async function queuedCheck() {
  const { jobQueue } = await query(JOBS)
  return (jobQueue || []).find((j) => j.description === JOB_DESCRIPTION) || null
}

export async function startCheck() {
  const data = await mutate(RUN, { plugin: PLUGIN_ID, task: TASK_NAME })
  return data.runPluginTask
}

export async function findJob(id) {
  const { findJob } = await query(JOB, { id })
  return findJob
}

// Scenes holding releases by their StashIDs, one aliased findScenes per
// stash-box: a release of a favourite studio may sit in a scene with no
// studio, or another one.
function heldQuery(n) {
  const vars = Array.from(
    { length: n },
    (_, i) => `$e${i}: String, $i${i}: [String]`,
  ).join(', ')
  const fields = Array.from(
    { length: n },
    (_, i) => `s${i}: findScenes(
      scene_filter: { stash_ids_endpoint: { endpoint: $e${i}, stash_ids: $i${i}, modifier: EQUALS } }
      filter: { per_page: -1 }
    ) { scenes { id stash_ids { endpoint stash_id } } }`,
  ).join('\n')
  return gql(`query NewReleasesHeld(${vars}) {\n${fields}\n}`)
}

// The scenes that hold any of a catalog's releases by StashID, and the
// releases that answer covers, as release keys (match.js), so the page
// shows a release only once it knows whether the user has it.
export async function heldScenes(catalog) {
  const byEndpoint = new Map()
  const keys = new Set()
  for (const r of catalog?.releases || []) {
    if (!r.endpoint || !r.id) continue
    const list = byEndpoint.get(r.endpoint) || []
    list.push(r.id)
    byEndpoint.set(r.endpoint, list)
    keys.add(releaseKey(r))
  }
  if (!byEndpoint.size) return { scenes: [], keys }
  const entries = [...byEndpoint]
  const variables = {}
  entries.forEach(([endpoint, ids], i) => {
    variables[`e${i}`] = endpoint
    variables[`i${i}`] = ids
  })
  const data = await query(heldQuery(entries.length), variables)
  return {
    scenes: entries.flatMap((_, i) => data[`s${i}`]?.scenes || []),
    keys,
  }
}

// The user's tags and performers, and their scenes from the favourite
// studios, for their addresses.
export async function loadLibrary(favourites) {
  const studios = favourites.map((s) => s.id)
  // With no studio to look in, an empty list would match every scene.
  const data = await query(LIBRARY, { studios, any: studios.length > 0 })
  return {
    tags: data.findTags.tags || [],
    performers: data.findPerformers.performers || [],
    scenes: data.findScenes?.scenes || [],
  }
}
