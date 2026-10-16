// Reads the user's library from Stash: every owned scene with its ratings and
// play history, and every performer. Large libraries load in pages, in the
// background, and a copy is kept in IndexedDB (tier 3: rebuildable) so the
// next visit starts from it and fetches only what changed.
//
// `run(query, variables)` sends one GraphQL request and returns its data. The
// runtime passes Stash's own client (no Apollo cache: thousands of scenes
// would bloat Stash's cache); tests pass a fake.
import { PERFORMERS, SCENES } from './queries.js'

const PAGE = 500
// A copy this old is reloaded in full, which also drops deleted scenes.
const FULL_RELOAD_MS = 24 * 3600 * 1000
// Changes are fetched again after this long, and on every front-page visit.
export const REFRESH_MS = 2 * 60 * 1000
// Plays and edits that land while a page is loading: fetch a little overlap.
const OVERLAP_MS = 60 * 1000
// 2: scenes carry custom_fields
const CACHE_VERSION = 2

// Every page of one find query, sorted by id so pages never shift.
async function fetchPages(run, query, field, list, variables, onPage) {
  const out = []
  for (let page = 1; ; page++) {
    const data = await run(query, {
      ...variables,
      filter: { per_page: PAGE, page, sort: 'id', direction: 'ASC' },
    })
    const result = data[field]
    out.push(...result[list])
    onPage?.(out.length, result.count)
    if (out.length >= result.count || !result[list].length) return out
  }
}

const changedSince = (iso) => ({
  scene_filter: {
    updated_at: { value: iso, modifier: 'GREATER_THAN' },
    OR: { last_played_at: { value: iso, modifier: 'GREATER_THAN' } },
  },
})

// Merges changed scenes into the cached list by id.
function merge(scenes, changed) {
  const byId = new Map(scenes.map((s) => [s.id, s]))
  for (const s of changed) byId.set(s.id, s)
  return [...byId.values()]
}

/**
 * @param {{ run: Function, cache?: { get: Function, set: Function },
 *   now?: number, force?: boolean, onProgress?: Function }} opts
 * @returns {Promise<{ scenes: object[], performers: object[], syncedAt: string, fromCache: boolean }>}
 */
export async function loadLibrary({
  run,
  cache,
  now = Date.now(),
  force = false,
  onProgress,
}) {
  const cached = cache ? await cache.get('library').catch(() => null) : null
  const usable = cached?.version === CACHE_VERSION && !force
  const age = usable ? now - Date.parse(cached.syncedAt) : Infinity
  if (usable && age < REFRESH_MS) return { ...cached, fromCache: true }

  const syncedAt = new Date(now).toISOString()
  let scenes
  if (usable && age < FULL_RELOAD_MS) {
    const since = new Date(Date.parse(cached.syncedAt) - OVERLAP_MS)
    const changed = await fetchPages(
      run,
      SCENES,
      'findScenes',
      'scenes',
      changedSince(since.toISOString()),
    )
    scenes = merge(cached.scenes, changed)
    // A count that differs means scenes were deleted (or the copy is off):
    // reload in full.
    const { findScenes } = await run(SCENES, { filter: { per_page: 0 } })
    if (findScenes.count !== scenes.length) scenes = null
  }
  if (!scenes)
    scenes = await fetchPages(
      run,
      SCENES,
      'findScenes',
      'scenes',
      {},
      (n, of) => onProgress?.({ kind: 'scenes', n, of }),
    )
  const performers = await fetchPages(
    run,
    PERFORMERS,
    'findPerformers',
    'performers',
    {},
    (n, of) => onProgress?.({ kind: 'performers', n, of }),
  )
  const library = { version: CACHE_VERSION, syncedAt, scenes, performers }
  if (cache) await cache.set('library', library).catch(() => {})
  return { ...library, fromCache: false }
}
