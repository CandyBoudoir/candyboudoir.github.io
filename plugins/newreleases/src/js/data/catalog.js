// The catalog the task keeps (src/py/newreleases.py), and when the page
// starts the task. Pure, so the unit tests run it in Node.
import { endpointKey } from './match.js'

// The page asks for a check when the last one finished this long ago, as
// the task asks each studio again after the same time.
export const STALE = 20 * 60 * 60 * 1000

// The catalog's shape, as the task writes it (CATALOG_VERSION in
// src/py/newreleases.py). A catalog of another version is due a check.
export const CATALOG_VERSION = 2

/**
 * Which favourite studios Stash can ask about: those with a StashID on a
 * stash-box set up in Stash. The rest are listed with a pointer to the
 * studio Tagger.
 */
export function linkedStudios(favourites, boxes) {
  const known = new Set((boxes || []).map((b) => endpointKey(b.endpoint)))
  const linked = []
  const unlinked = []
  for (const s of favourites || []) {
    const on = (s.stash_ids || []).some(
      (x) => x?.stash_id && known.has(endpointKey(x.endpoint)),
    )
    ;(on ? linked : unlinked).push(s)
  }
  return { linked, unlinked }
}

/**
 * Whether to start a check now: none is queued, there is a studio to ask
 * about, and the catalog is missing, from an older version of the plugin, a
 * day old, from a check that never finished, or from before a studio was
 * favourited.
 */
export function shouldStart({ catalog, linked, queued, now = Date.now() }) {
  if (queued || !linked.length) return false
  if (catalog && catalog.version !== CATALOG_VERSION) return true
  const run = catalog?.run
  if (!run?.finished) return true
  if (now - Date.parse(run.finished) >= STALE) return true
  const seen = new Set((run.favourites || []).map(String))
  return linked.some((s) => !seen.has(String(s.id)))
}

/** "3 hours ago", "yesterday", for when the catalog was last checked. */
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const minutes = Math.round((now - t) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

// "Tue 14 Oct", for when a stopped stash-box is asked again.
const whenText = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

/**
 * The lines the page shows about the stash-boxes and studios: a box with
 * no key, one that refused it, one that asked to be left alone, and the
 * studios a stash-box does not know. Each { key, text }.
 */
export function problems(catalog, favourites, now = Date.now()) {
  const out = []
  for (const [endpoint, box] of Object.entries(catalog?.boxes || {})) {
    const name = box.name || endpoint
    if (box.error === 'no API key')
      out.push({
        key: `key:${endpoint}`,
        text: `${name} has no API key in Settings › Metadata Providers, so New Releases can't ask it.`,
      })
    else if (/^refused the API key/.test(box.error || ''))
      out.push({
        key: `refused:${endpoint}`,
        text: `${name} refused its API key. Check it in Settings › Metadata Providers.`,
      })
    else if (box.pausedUntil && Date.parse(box.pausedUntil) > now)
      out.push({
        key: `paused:${endpoint}`,
        text: `${name} asked New Releases to stop for now (${String(box.error || '').replace(/^stopped: /, '')}). It asks again ${whenText(box.pausedUntil)}.`,
      })
  }
  const favourite = new Set((favourites || []).map((s) => String(s.id)))
  const missing = Object.entries(catalog?.studios || {})
    .filter(([id, s]) => favourite.has(id) && /^not found/.test(s.error || ''))
    .map(([, s]) => s.name)
  if (missing.length)
    out.push({
      key: 'not-found',
      text: `Not found on their stash-box: ${missing.join(', ')}. Check their StashIDs in the studio Tagger.`,
    })
  return out
}
