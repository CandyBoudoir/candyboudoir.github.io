// When a configuration write is safe to send. Stash 0.30.0 to 0.31.1 can
// freeze until it is restarted when a write reaches it while it serves a
// request that reads its SFW setting: the image of a performer who has none,
// or any configuration query (docs/stash-seams.md). So Cherry Pick's writes
// wait until this page has been quiet for a moment: no such image loading on
// screen or loaded just before, none of Stash's own queries out (a list that
// arrives brings its images), and Stash's own copy of its configuration in
// place (Stash fetches it again after the writes its own pages make). Images other pages and
// other browsers load are out of sight, so this lowers the odds, no more.
import { client, GQL } from './api.js'

// Stash adds default=true to the image address of a performer with no image
const NO_IMAGE = /\/performer\/\d+\/image\?(?:[^#]*&)?default=true(?:&|#|$)/
// how long the page stays quiet before it counts as settled
const QUIET_MS = 500
const CHECK_MS = 100
// a page that never settles still gets its writes
const MAX_WAIT_MS = 10_000

// when the last image of a performer with no image finished loading
let lastLoaded = -Infinity
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (NO_IMAGE.test(e.name))
        lastLoaded = Math.max(lastLoaded, e.responseEnd || e.startTime)
  }).observe({ type: 'resource', buffered: true })
} catch {
  // No resource timing: the images still loading still count.
}

// A lazy image off screen waits to be scrolled to before it loads.
function onScreen(img) {
  if (!img.getClientRects().length) return false
  const r = img.getBoundingClientRect()
  return (
    r.bottom >= 0 &&
    r.right >= 0 &&
    r.top <= window.innerHeight &&
    r.left <= window.innerWidth
  )
}

function imagesLoading() {
  for (const img of document.images)
    if (
      !img.complete &&
      NO_IMAGE.test(img.src) &&
      (img.loading !== 'lazy' || onScreen(img))
    )
      return true
  return false
}

// The queries Stash's pages watch, one still out
function queriesLoading() {
  try {
    for (const q of client().getObservableQueries('active').values())
      if (q.getCurrentResult().loading) return true
  } catch {
    // An Apollo without the list: the images still count.
  }
  return false
}

// Stash's cached configuration goes after a write that drops it (Stash's
// own pages' writes do) and comes back once Stash's query for it answers.
function configurationCached() {
  try {
    return !!client().readQuery({ query: GQL.ConfigurationDocument })
  } catch {
    return false
  }
}

const busy = () => imagesLoading() || queriesLoading() || !configurationCached()

export function whenSettled(maxWait = MAX_WAIT_MS) {
  const start = performance.now()
  let quietSince = null
  return new Promise((resolve) => {
    const check = () => {
      const now = performance.now()
      if (busy()) quietSince = null
      else quietSince ??= now
      const quiet =
        quietSince != null && now - Math.max(quietSince, lastLoaded) >= QUIET_MS
      if (quiet || now - start >= maxWait) resolve()
      else setTimeout(check, CHECK_MS)
    }
    check()
  })
}
