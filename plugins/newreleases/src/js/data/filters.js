// The page's filters and page, kept in the address as Stash keeps its
// lists' (p and perPage), so a filtered page can be bookmarked and shared:
// ?studio=12&performer=40&tag=-~feet&p=2&perPage=60. A performer or tag is
// the user's id, or "~" and the stash-box's name; a leading "-" leaves it
// out. Pure, so the unit tests run it in Node.
//
// A release shows when the user does not have it, is from any of the
// studios picked, has any of the performers picked and all of the tags, and
// none of those left out.

// Stash's page sizes and its default (List/ListFilter.tsx, list-filter)
export const PAGE_SIZES = [20, 40, 60, 120, 250, 500, 1000]
export const PER_PAGE = 40

export const EMPTY = {
  studios: [],
  performers: [],
  tags: [],
  page: 1,
  perPage: PER_PAGE,
}

const picks = (values) =>
  values
    .filter(Boolean)
    .map((v) =>
      v.startsWith('-')
        ? { key: v.slice(1), exclude: true }
        : { key: v, exclude: false },
    )
    .filter((p) => p.key)

const positive = (value, fallback, max = Infinity) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback
}

/** The filters and page in a location's query string. */
export function parseFilters(search) {
  const q = new URLSearchParams(search || '')
  return {
    studios: q.getAll('studio').filter(Boolean),
    performers: picks(q.getAll('performer')),
    tags: picks(q.getAll('tag')),
    page: positive(q.get('p'), 1),
    perPage: positive(q.get('perPage'), PER_PAGE, 1000),
  }
}

/** The query string for a set of filters, other parameters kept. */
export function formatFilters(filters, search = '') {
  const q = new URLSearchParams(search)
  for (const k of ['studio', 'performer', 'tag', 'p', 'perPage']) q.delete(k)
  for (const s of filters.studios) q.append('studio', s)
  for (const p of filters.performers)
    q.append('performer', `${p.exclude ? '-' : ''}${p.key}`)
  for (const t of filters.tags)
    q.append('tag', `${t.exclude ? '-' : ''}${t.key}`)
  if (filters.page > 1) q.set('p', String(filters.page))
  if (filters.perPage !== PER_PAGE) q.set('perPage', String(filters.perPage))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const isFiltered = (f) =>
  !!(f.studios.length || f.performers.length || f.tags.length)

/** The releases the filters let through, in the order given. */
export function applyFilters(releases, f) {
  const studios = new Set(f.studios.map(String))
  const split = (list) => ({
    inc: list.filter((p) => !p.exclude).map((p) => p.key),
    exc: new Set(list.filter((p) => p.exclude).map((p) => p.key)),
  })
  const perf = split(f.performers)
  const tag = split(f.tags)
  return releases.filter((r) => {
    if (r.owner) return false
    if (studios.size && !studios.has(String(r.studio.id))) return false
    const pk = new Set(r.performers.map((p) => p.key))
    if (perf.inc.length && !perf.inc.some((k) => pk.has(k))) return false
    if ([...perf.exc].some((k) => pk.has(k))) return false
    const tk = new Set(r.tags.map((t) => t.key))
    if (!tag.inc.every((k) => tk.has(k))) return false
    if ([...tag.exc].some((k) => tk.has(k))) return false
    return true
  })
}

/** One page of a list, the page clamped to the last one there is. */
export function pageOf(list, { page, perPage }) {
  const pages = Math.max(1, Math.ceil(list.length / perPage))
  const current = Math.min(page, pages)
  const start = (current - 1) * perPage
  return { items: list.slice(start, start + perPage), page: current, pages }
}

/**
 * The performers or tags across the releases the user does not have, as
 * { key, name, count }, most releases first, then by name. `pick` is
 * 'performers' or 'tags'.
 */
export function optionsOf(releases, pick) {
  const byKey = new Map()
  for (const r of releases) {
    if (r.owner) continue
    for (const x of r[pick]) {
      const o = byKey.get(x.key)
      if (o) o.count += 1
      else byKey.set(x.key, { key: x.key, name: x.name, count: 1 })
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}
