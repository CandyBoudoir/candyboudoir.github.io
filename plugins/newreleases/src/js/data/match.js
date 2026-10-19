// Matching a stash-box's tags, performers and scenes to the user's own, and
// turning the task's catalog into the releases the page shows. Pure, so the
// unit tests run it in Node.
//
// A tag or performer is the user's when one of theirs carries its StashID
// on that stash-box, else when exactly one of theirs has its name or an
// alias of it. Case, accents and punctuation make no difference. Anything
// unmatched keeps the stash-box's name.

// A stash-box endpoint as a key: Stash stores the address as typed.
export const endpointKey = (endpoint) =>
  String(endpoint || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase()

const idKey = (endpoint, id) => `${endpointKey(endpoint)}|${id}`

export function nameKey(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * An index of the user's tags or performers: by StashID per endpoint, and
 * by every name and alias.
 * @param {{ id: string, name: string, stash_ids?: { endpoint: string, stash_id: string }[] }[]} list
 * @param {(x: any) => string[]} aliasesOf
 */
export function entityIndex(list, aliasesOf) {
  const byStashId = new Map()
  const byName = new Map()
  for (const x of list || []) {
    for (const s of x.stash_ids || [])
      if (s?.stash_id) byStashId.set(idKey(s.endpoint, s.stash_id), x)
    for (const n of new Set(
      [x.name, ...(aliasesOf(x) || [])].map(nameKey).filter(Boolean),
    )) {
      const hits = byName.get(n)
      if (hits) hits.push(x)
      else byName.set(n, [x])
    }
  }
  return { byStashId, byName }
}

export const tagIndex = (tags) => entityIndex(tags, (t) => t.aliases)
export const performerIndex = (performers) =>
  entityIndex(performers, (p) => p.alias_list)

/** The user's own record for a stash-box tag or performer, or null. */
export function matchOne(index, endpoint, item) {
  if (item?.id) {
    const hit = index.byStashId.get(idKey(endpoint, item.id))
    if (hit) return hit
  }
  for (const name of [item?.name, ...(item?.also || [])]) {
    const hits = index.byName.get(nameKey(name))
    if (hits?.length === 1) return hits[0]
  }
  return null
}

// The key a tag or performer filters by: the user's id, or "~" and the
// stash-box's name for one they don't have.
const filterKey = (local, item) =>
  local ? String(local.id) : `~${String(item.name).trim().toLowerCase()}`

function mapItems(items, index, endpoint) {
  const seen = new Set()
  const out = []
  for (const item of items || []) {
    if (!item?.name) continue
    const local = matchOne(index, endpoint, item)
    const key = filterKey(local, item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      name: local ? local.name : item.name,
      local: local ? String(local.id) : null,
    })
  }
  return out
}

// A web address as it is compared for ownership: no scheme, "www." or
// trailing slash, and the host in lower case.
export function urlKey(raw) {
  try {
    const url = new URL(raw)
    if (!/^https?:$/.test(url.protocol)) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = url.pathname.replace(/\/+$/, '')
    return `${host}${path}${url.search}`
  } catch {
    return null
  }
}

/**
 * Who owns what: the user's scenes by StashID per endpoint and by address.
 * @param {{ id: string, stash_ids?: { endpoint: string, stash_id: string }[], urls?: string[] }[]} scenes
 */
export function ownedIndex(scenes) {
  const byStashId = new Map()
  const byUrl = new Map()
  for (const s of scenes || []) {
    for (const x of s.stash_ids || [])
      if (x?.stash_id) byStashId.set(idKey(x.endpoint, x.stash_id), s.id)
    for (const u of s.urls || []) {
      const k = urlKey(u)
      if (k) byUrl.set(k, s.id)
    }
  }
  return { byStashId, byUrl }
}

/** The user's scene holding a release, by its StashID or its address. */
export function ownerOf(owned, release) {
  return (
    owned.byStashId.get(idKey(release.endpoint, release.id)) ??
    (release.url ? owned.byUrl.get(urlKey(release.url)) : null) ??
    null
  )
}

/**
 * The catalog's releases as the page shows them, newest first: each with
 * the user's studio, tags and performers where they have them, and the
 * scene that holds it, if one does. Releases of studios no longer
 * favourited are left out.
 */
export function presentReleases(catalog, { studios, tags, performers, owned }) {
  const studioById = new Map((studios || []).map((s) => [String(s.id), s]))
  const out = []
  const seen = new Set()
  for (const r of catalog?.releases || []) {
    const studio = studioById.get(String(r.studio))
    if (!studio || !r.id) continue
    const key = idKey(r.endpoint, r.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      id: r.id,
      endpoint: r.endpoint,
      title: r.title || '',
      date: r.date || null,
      duration: r.duration ?? null,
      url: r.url || null,
      image: r.image || null,
      studio,
      owner: ownerOf(owned, r),
      performers: mapItems(r.performers, performers, r.endpoint),
      tags: mapItems(r.tags, tags, r.endpoint),
    })
  }
  return out.sort(
    (a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      a.title.localeCompare(b.title),
  )
}
