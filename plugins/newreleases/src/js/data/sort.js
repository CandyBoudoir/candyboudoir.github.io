// The orders the page offers, as Stash's scene lists offer theirs: Stash's
// sorts that a release has, under Stash's names, plus Found, when a check
// first found the release. Which releases count as New, and where a running
// check's arrivals go. Pure, so the unit tests run it in Node.

// Listed by name, as Stash's sort menu lists them
export const SORTS = [
  { value: 'date', label: 'Date' },
  { value: 'duration', label: 'Duration' },
  { value: 'found', label: 'Found' },
  { value: 'performer_count', label: 'Performer Count' },
  { value: 'random', label: 'Random' },
  { value: 'studio', label: 'Studio' },
  { value: 'tag_count', label: 'Tag Count' },
  { value: 'title', label: 'Title' },
]
export const DEFAULT_SORT = 'date'

// Stash's rule for an address with no sortdir (ListFilterModel): ascending,
// except for the date, which is newest first.
export const defaultDir = (sortBy) => (sortBy === 'date' ? 'desc' : 'asc')

// Stash's random seeds have eight digits.
export const newSeed = () => Math.floor(Math.random() * 10 ** 8)

const text = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

// A release's place in a seeded shuffle: the same seed, the same order.
function shuffled(seed, key) {
  let h = (seed ?? 0) ^ 0x9e3779b9
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x85ebca6b)
    h ^= h >>> 13
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

// What each sort compares, or null when the release has none
const VALUE = {
  date: (r) => r.date || null,
  duration: (r) => r.duration ?? null,
  found: (r) => r.found || null,
  performer_count: (r) => r.performers.length,
  tag_count: (r) => r.tags.length,
  studio: (r) => r.studio?.name || null,
  title: (r) => r.title || null,
}

const compareValues = (a, b) =>
  typeof a === 'string' ? text(a, b) : a < b ? -1 : a > b ? 1 : 0

// Ties fall back to the newest release, then the title
export function newestFirst(a, b) {
  return (
    (b.date || '').localeCompare(a.date || '') ||
    text(a.title || '', b.title || '') ||
    a.key.localeCompare(b.key)
  )
}

/**
 * The releases in the order picked: { sortBy, sortDir, seed } as the
 * address keeps them. The direction turns the sort round; releases with
 * nothing to sort by (no duration, found before the plugin kept it) go last
 * either way.
 */
export function sortReleases(releases, { sortBy, sortDir, seed }) {
  const flip = sortDir === 'desc' ? -1 : 1
  if (sortBy === 'random') {
    const rank = new Map(releases.map((r) => [r.key, shuffled(seed, r.key)]))
    return [...releases].sort(
      (a, b) => flip * (rank.get(a.key) - rank.get(b.key)) || newestFirst(a, b),
    )
  }
  const value = VALUE[sortBy] || VALUE[DEFAULT_SORT]
  return [...releases].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x == null || y == null) {
      if (x != null) return -1
      if (y != null) return 1
      return newestFirst(a, b)
    }
    return flip * compareValues(x, y) || newestFirst(a, b)
  })
}

/**
 * When the latest check asked each studio, in the catalog the page opened
 * with, for isNew. Studios a check asked before the plugin kept the time
 * fall back to when that check started.
 */
export function newSince(catalog) {
  const studios = new Map()
  for (const [id, s] of Object.entries(catalog?.studios || {})) {
    const t = Date.parse(s?.asked)
    if (Number.isFinite(t)) studios.set(String(id), t)
  }
  return { studios, run: Date.parse(catalog?.run?.started) }
}

/**
 * Whether a release is New: its studio's latest check when the page opened
 * found it, or a check since did. Not what a studio's first check found,
 * which is new to the catalog only. `since` is newSince's.
 */
export function isNew(release, since) {
  if (!release.found || release.first || !since) return false
  const from = since.studios.get(String(release.studio?.id)) ?? since.run
  if (!Number.isFinite(from)) return false
  return Date.parse(release.found) >= from
}

/**
 * Where releases go while the page is open. The list keeps the releases the
 * page opened with (`opened`, their keys); what a running check adds after
 * goes to Just in, newest arrival first, until the next visit. A page that
 * opened with nothing (`opened` null) has nothing to hold still, so its list
 * takes everything. `arrived` is what the previous call returned: each Just
 * in release's arrival, counted in reads of the catalog.
 * @returns {{ list: any[], justIn: any[], arrived: Map<string, number> }}
 */
export function splitArrivals(releases, opened, arrived = new Map()) {
  if (!opened) return { list: releases, justIn: [], arrived }
  const next = new Map(arrived)
  const read = Math.max(0, ...next.values()) + 1
  const list = []
  const justIn = []
  for (const r of releases) {
    if (opened.has(r.key)) list.push(r)
    else {
      if (!next.has(r.key)) next.set(r.key, read)
      justIn.push(r)
    }
  }
  justIn.sort((a, b) => next.get(b.key) - next.get(a.key) || newestFirst(a, b))
  return { list, justIn, arrived: next }
}
