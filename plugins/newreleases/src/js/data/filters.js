// The page's filters, kept in the address so a filtered page can be
// bookmarked and shared: ?studio=12&performer=40&tag=-~feet&days=30&owned=hide.
// A performer or tag is the user's id, or "~" and the stash-box's name; a
// leading "-" leaves it out. Pure, so the unit tests run it in Node.
//
// A release shows when it is from any of the studios picked, has any of the
// performers picked and all of the tags, none of those left out, and falls
// in the date window.

export const DAY_WINDOWS = [
  { days: 0, label: 'Any time' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
]

export const EMPTY = {
  studios: [],
  performers: [],
  tags: [],
  days: 0,
  hideOwned: false,
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

/** The filters in a location's query string. */
export function parseFilters(search) {
  const q = new URLSearchParams(search || '')
  const days = Number(q.get('days'))
  return {
    studios: q.getAll('studio').filter(Boolean),
    performers: picks(q.getAll('performer')),
    tags: picks(q.getAll('tag')),
    days: DAY_WINDOWS.some((w) => w.days === days) ? days : 0,
    hideOwned: q.get('owned') === 'hide',
  }
}

/** The query string for a set of filters, other parameters kept. */
export function formatFilters(filters, search = '') {
  const q = new URLSearchParams(search)
  for (const k of ['studio', 'performer', 'tag', 'days', 'owned']) q.delete(k)
  for (const s of filters.studios) q.append('studio', s)
  for (const p of filters.performers)
    q.append('performer', `${p.exclude ? '-' : ''}${p.key}`)
  for (const t of filters.tags)
    q.append('tag', `${t.exclude ? '-' : ''}${t.key}`)
  if (filters.days) q.set('days', String(filters.days))
  if (filters.hideOwned) q.set('owned', 'hide')
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const isFiltered = (f) =>
  !!(
    f.studios.length ||
    f.performers.length ||
    f.tags.length ||
    f.days ||
    f.hideOwned
  )

const DAY = 24 * 60 * 60 * 1000

/** The releases the filters let through, in the order given. */
export function applyFilters(releases, f, now = Date.now()) {
  const since = f.days ? now - f.days * DAY : null
  const studios = new Set(f.studios.map(String))
  const split = (list) => ({
    inc: list.filter((p) => !p.exclude).map((p) => p.key),
    exc: new Set(list.filter((p) => p.exclude).map((p) => p.key)),
  })
  const perf = split(f.performers)
  const tag = split(f.tags)
  return releases.filter((r) => {
    if (studios.size && !studios.has(String(r.studio.id))) return false
    if (since != null) {
      const t = r.date ? Date.parse(r.date) : NaN
      if (!(t >= since)) return false
    }
    if (f.hideOwned && r.owner) return false
    const pk = new Set(r.performers.map((p) => p.key))
    if (perf.inc.length && !perf.inc.some((k) => pk.has(k))) return false
    if ([...perf.exc].some((k) => pk.has(k))) return false
    const tk = new Set(r.tags.map((t) => t.key))
    if (!tag.inc.every((k) => tk.has(k))) return false
    if ([...tag.exc].some((k) => tk.has(k))) return false
    return true
  })
}

/**
 * The performers or tags across the releases, as { key, name, count },
 * most releases first, then by name. `pick` is 'performers' or 'tags'.
 */
export function optionsOf(releases, pick) {
  const byKey = new Map()
  for (const r of releases)
    for (const x of r[pick]) {
      const o = byKey.get(x.key)
      if (o) o.count += 1
      else byKey.set(x.key, { key: x.key, name: x.name, count: 1 })
    }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}
