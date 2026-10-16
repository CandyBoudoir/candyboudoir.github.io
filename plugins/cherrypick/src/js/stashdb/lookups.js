// The lookups a page asks for, each through the client's cache. Each one
// resolves to { part, entries } (part: a piece of the stashdb input;
// entries: the cache entries it came from, as "key@time", so the runtime can
// tell an answer it already merged), or null when StashDB could not be asked.
// Pure: the client comes in as an argument.
import {
  performerPart,
  performerScenesVariables,
  SCENE_BATCH,
  SCENE_QUERY,
  sceneFromApi,
  scenesByIdQuery,
  scenesByIdVariables,
  studioPart,
  studioScenesVariables,
} from './queries.js'

const stamp = (key, entry) => `${key}@${entry.at}`

// A list query's answer, kept as StashDB sent it (count and scenes).
const listLoad = (client, variables) => async () => {
  const data = await client.request(SCENE_QUERY, variables)
  return data?.queryScenes ?? undefined
}

// A performer's scenes, most popular first, and how many they have.
export async function performerScenes(client, id) {
  const key = 'performer-scenes:' + id
  const entry = await client.cached(
    key,
    listLoad(client, performerScenesVariables(id)),
  )
  if (!entry) return null
  return { part: performerPart(id, entry.data), entries: [stamp(key, entry)] }
}

// A studio's most popular scenes.
export async function studioScenes(client, id) {
  const key = 'studio-scenes:' + id
  const entry = await client.cached(
    key,
    listLoad(client, studioScenesVariables(id)),
  )
  if (!entry) return null
  return { part: studioPart(id, entry.data), entries: [stamp(key, entry)] }
}

// Scenes by id, with their held-by counts. Cached per scene; the ones not
// cached go in one request per SCENE_BATCH. A scene StashDB does not have
// is cached as null and adds nothing.
export async function scenesById(client, ids) {
  const scenes = []
  const entries = []
  const missing = []
  for (const id of [...new Set(ids)]) {
    const hit = await client.peek('scene:' + id)
    if (!hit) missing.push(id)
    else {
      entries.push(stamp('scene:' + id, hit))
      if (hit.data) scenes.push(hit.data)
    }
  }
  let complete = true
  for (let i = 0; i < missing.length; i += SCENE_BATCH) {
    const chunk = missing.slice(i, i + SCENE_BATCH)
    const data = await client.request(
      scenesByIdQuery(chunk.length),
      scenesByIdVariables(chunk),
    )
    if (!data) {
      complete = false
      continue
    }
    for (const [j, id] of chunk.entries()) {
      const row = data['s' + j]
      const scene = row ? sceneFromApi(row) : null
      const entry = await client.put('scene:' + id, scene)
      entries.push(stamp('scene:' + id, entry))
      if (scene) scenes.push(scene)
    }
  }
  if (!complete && !scenes.length) return null
  return { part: { scenes }, entries, complete }
}
