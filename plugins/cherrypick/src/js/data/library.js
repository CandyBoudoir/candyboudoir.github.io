// Reads the user's library from Stash: every owned scene with its ratings and
// play history, and every performer. Large libraries load in pages, in the
// background, and a copy is kept in IndexedDB (tier 3: rebuildable) so the
// next visit starts from it and fetches only what changed.
//
// `run(query, variables)` sends one GraphQL request and returns its data. The
// runtime passes Stash's own client (no Apollo cache: thousands of scenes
// would bloat Stash's cache); tests pass a fake.
import { PERFORMERS, SCENE_TIMES, SCENES } from './queries.js'

const PAGE = 500
// Changed scenes are looked for this many at a time first, then a page at
// a time.
const STEP = 50
// A copy whose last full read is this old is read again in full, which
// also drops deleted scenes and catches what no update sees (a play or an
// O removed, play time saved without a play).
const FULL_RELOAD_MS = 24 * 3600 * 1000
// Changes are fetched again after this long, and on every front-page visit.
export const REFRESH_MS = 2 * 60 * 1000
// Changes in the same second as the newest one seen, or saved while a page
// loads: fetch a little overlap.
const OVERLAP_MS = 60 * 1000
// 2: scenes carry custom_fields. 3: updates find changed scenes by sorting
// (`cursors`), and the age of the last full read (`fullAt`) decides when to
// read in full. 4: files carry video_codec, width and height, for scene brackets.
const CACHE_VERSION = 4

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

const latest = (times) =>
  times?.reduce(
    (a, t) => (a == null || Date.parse(t) > Date.parse(a) ? t : a),
    null,
  ) ?? null

// The changes a scene can have, each with the sort Stash offers for it and
// the time it keeps. An edit (rating, custom fields, title, tags) moves
// updated_at; a play moves last_played_at and an O adds to o_history, and
// neither touches updated_at.
const CHANGES = [
  { sort: 'updated_at', at: (s) => s.updated_at },
  { sort: 'last_played_at', at: (s) => s.last_played_at },
  { sort: 'last_o_at', at: (s) => latest(s.o_history) },
]

// The newest time of each change, before a full read starts: anything
// newer is left to the next update.
async function cursorsNow(run) {
  const out = {}
  for (const { sort, at } of CHANGES) {
    const { findScenes } = await run(SCENE_TIMES, {
      filter: { per_page: 1, page: 1, sort, direction: 'DESC' },
    })
    out[sort] = findScenes.scenes[0] ? at(findScenes.scenes[0]) : null
  }
  return out
}

// Whether the copy of a scene holds the times Stash now has for it
const sameTime = (a, b) =>
  a === b || (a != null && b != null && Date.parse(a) === Date.parse(b))
const current = (copy, row) =>
  !!copy &&
  sameTime(copy.updated_at, row.updated_at) &&
  sameTime(copy.last_played_at, row.last_played_at) &&
  copy.o_counter === row.o_counter

// The ids of the scenes changed since the copy was read, and the cursors to
// keep (the newest time of each change seen). Stash's timestamp filters
// compare the value sent with the time it stores as text in the server's
// own zone, so on a server outside UTC a filter in UTC misses hours of
// edits. So each change is read newest first, down to a minute before the
// newest the copy saw, and its times are compared here, as instants; of
// those, only scenes whose times differ from the copy's are fetched.
async function changedIds(run, cached) {
  const copy = new Map(cached.scenes.map((s) => [s.id, s]))
  const ids = new Set()
  const cursors = {}
  for (const { sort, at } of CHANGES) {
    const was = cached.cursors[sort] ?? null
    const since = was == null ? null : Date.parse(was) - OVERLAP_MS
    let newest = was
    let per = STEP
    let page = 1
    for (;;) {
      const { findScenes } = await run(SCENE_TIMES, {
        filter: { per_page: per, page, sort, direction: 'DESC' },
      })
      const rows = findScenes.scenes
      let done = rows.length < per
      for (const s of rows) {
        const t = at(s)
        if (t == null || (since != null && Date.parse(t) < since)) {
          done = true
          break
        }
        if (!current(copy.get(s.id), s)) ids.add(s.id)
        if (newest == null || Date.parse(t) > Date.parse(newest)) newest = t
      }
      if (done) break
      // More than one step to look through: go on a page at a time (the
      // first page reads the step again, which the set absorbs)
      if (per === STEP) {
        per = PAGE
        page = 1
      } else page++
    }
    cursors[sort] = newest
  }
  return { ids: [...ids], cursors }
}

// The changed scenes in full, a page of ids at a time
async function fetchByIds(run, ids) {
  const out = []
  for (let i = 0; i < ids.length; i += PAGE) {
    const { findScenes } = await run(SCENES, {
      ids: ids.slice(i, i + PAGE),
      filter: { per_page: -1 },
    })
    out.push(...findScenes.scenes)
  }
  return out
}

// Merges changed scenes into the cached list by id.
function merge(scenes, changed) {
  const byId = new Map(scenes.map((s) => [s.id, s]))
  for (const s of changed) byId.set(s.id, s)
  return [...byId.values()]
}

/**
 * @param {{ run: Function, cache?: { get: Function, set: Function },
 *   now?: number, force?: boolean, onProgress?: Function }} opts
 * @returns {Promise<{ scenes: object[], performers: object[], syncedAt: string,
 *   fullAt: string, cursors: object, fromCache: boolean }>}
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
  if (usable && now - Date.parse(cached.syncedAt) < REFRESH_MS)
    return { ...cached, fromCache: true }

  const syncedAt = new Date(now).toISOString()
  let scenes
  let cursors
  let fullAt = usable ? cached.fullAt : null
  if (usable && now - Date.parse(fullAt) < FULL_RELOAD_MS) {
    const found = await changedIds(run, cached)
    cursors = found.cursors
    scenes = merge(cached.scenes, await fetchByIds(run, found.ids))
    // A count that differs means scenes were deleted (or the copy is off):
    // reload in full.
    const { findScenes } = await run(SCENES, { filter: { per_page: 0 } })
    if (findScenes.count !== scenes.length) scenes = null
  }
  // onProgress reports a full read only: a first visit, or a copy too old or
  // out of step to update. The performers, fetched whole every time, take
  // well under a second on top of an update.
  const full = !scenes
  if (full) {
    cursors = await cursorsNow(run)
    fullAt = syncedAt
    scenes = await fetchPages(
      run,
      SCENES,
      'findScenes',
      'scenes',
      {},
      (n, of) => onProgress?.({ kind: 'scenes', n, of }),
    )
  }
  const performers = await fetchPages(
    run,
    PERFORMERS,
    'findPerformers',
    'performers',
    {},
    full ? (n, of) => onProgress?.({ kind: 'performers', n, of }) : undefined,
  )
  const library = {
    version: CACHE_VERSION,
    syncedAt,
    fullAt,
    cursors,
    scenes,
    performers,
  }
  if (cache) await cache.set('library', library).catch(() => {})
  return { ...library, fromCache: false }
}
