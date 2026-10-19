// A stand-in for ThePornDB's REST API, so no test ever calls the real
// service. The mock stash-box (stashbox.mjs) serves it under /tpdb/, and New
// Releases' unit tests mount the same handler on a server of their own. It
// answers the two requests New Releases makes, with the shapes ThePornDB
// documents:
//   GET /sites/<uuid>                     a site by its StashID: { data: { id, uuid, name } }
//   GET /scenes?site_id=<id>&per_page=25&orderBy=recently_released
//                                         a site's newest scenes: { data: [scene] }
// Requests need `Authorization: Bearer <key>`; a key starting "invalid" gets
// 401, as ThePornDB answers a bad key. Three sites answer every scenes
// request with what makes the task stop: 429, 503, and a Cloudflare
// challenge page. Every request is recorded, with its headers and when it
// started and ended, for the tests to check the task's manners:
//   GET /_requests     the log, and how many requests were ever in flight at once
//   DELETE /_requests  clears it
import { STASH_BOX } from './stashbox-data.mjs'

export const TPDB_PREFIX = '/tpdb'
// What prepare-like setups register in Stash as the ThePornDB stash-box, and
// where its REST API is (New Releases' undeclared tpdbEndpoint and tpdbApi
// settings, honoured only on this machine).
export const TPDB_ENDPOINT = `${STASH_BOX}${TPDB_PREFIX}/graphql`
export const TPDB_API = `${STASH_BOX}${TPDB_PREFIX}`
export const TPDB_NAME = 'ThePornDB'
export const TPDB_STASH_BOX = {
  name: TPDB_NAME,
  endpoint: TPDB_ENDPOINT,
  api_key: 'tpdb-demo',
}

const uuid = (n) => `5c1b0a52-7d43-4b8e-9a51-${String(n).padStart(12, '0')}`
const image = (key) => `${STASH_BOX}/images/${key}.png`

// Each site: its StashID, ThePornDB's numeric id, and its studio's domain.
export const TPDB_SITES = {
  lollipop: { uuid: uuid(4101), id: 4101, name: 'Lollipop Lounge' },
  gumball: { uuid: uuid(4102), id: 4102, name: 'Gumball Gallery' },
  // Its newest release is years old, so it is asked once a week.
  sleepy: { uuid: uuid(4103), id: 4103, name: 'Sleepy Sweets' },
  // Their scenes requests answer with what stops the task.
  slowDown: { uuid: uuid(4429), id: 4429, name: 'Slow Down Sugar' },
  down: { uuid: uuid(4503), id: 4503, name: 'Down Drops' },
  challenge: { uuid: uuid(4403), id: 4403, name: 'Challenge Chews' },
}
// StashIDs ThePornDB has no site for.
export const TPDB_UNKNOWN = uuid(4404)

const FAILING = {
  [TPDB_SITES.slowDown.id]: 429,
  [TPDB_SITES.down.id]: 503,
  [TPDB_SITES.challenge.id]: 'challenge',
}

const tag = (n, name) => ({ id: n, uuid: uuid(7000 + n), name })
const TAGS = {
  candy: tag(1, 'Candy'),
  glossy: tag(2, 'Glossy'),
  pastel: tag(3, 'Pastel'),
  bubblegum: tag(4, 'Bubblegum'),
  sprinkles: tag(5, 'Sprinkles'),
  fizzy: tag(6, 'Fizzy'),
  sour: tag(7, 'Sour'),
  retro: tag(8, 'Retro'),
}

// A performer as a scene credits them on a site, with the performer
// ThePornDB files them under as `parent`.
const performer = (n, name, credited = name) => ({
  id: uuid(8000 + n),
  _id: 8000 + n,
  name: credited,
  parent: { id: uuid(9000 + n), _id: 9000 + n, name },
})
const PERFORMERS = {
  gigi: performer(1, 'Gumdrop Gigi'),
  bijou: performer(2, 'Bonbon Bijou', 'Bijou'),
  patti: performer(3, 'Peppermint Patti'),
  belle: performer(4, 'Butterscotch Belle'),
  coco: performer(5, 'Caramel Coco'),
}

// Portrait pictures the mock stash-box serves (stashbox-data.mjs), 400 x 600
const POSTERS = ['gigi', 'bijou', 'sherbet', 'mae', 'trixie']

const slug = (title) => title.toLowerCase().replace(/\W+/g, '-')

const daysAgo = (n) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

let next = 0
function scene(site, domain, [title, released, cover, cast, tags, duration]) {
  next += 1
  const date = typeof released === 'number' ? daysAgo(released) : released
  const s = slug(title)
  return {
    id: uuid(6000 + next),
    _id: 6000 + next,
    type: 'Scene',
    title,
    slug: s,
    external_id: `${site.id}-${String(next).padStart(3, '0')}`,
    // The studio's own page, with the tracking New Releases drops.
    url: `https://${domain}/clips/${s}?utm_source=theporndb&aff=4242`,
    date,
    duration,
    description: `${title}, invented for New Releases' tests.`,
    // The studio's picture and ThePornDB's landscape copies of it, and
    // ThePornDB's portrait posters, which a scene card would crop
    image: image(cover),
    background: {
      full: image(cover),
      large: image(cover),
      medium: image(cover),
      small: image(cover),
    },
    poster: image(POSTERS[next % POSTERS.length]),
    posters: {
      large: image(POSTERS[next % POSTERS.length]),
      medium: image(POSTERS[next % POSTERS.length]),
      small: image(POSTERS[next % POSTERS.length]),
    },
    trailer: `https://cdn.${domain}/trailers/${s}.mp4`,
    site: { id: site.id, uuid: site.uuid, name: site.name },
    tags: tags.map((t) => TAGS[t]),
    performers: cast.map((p) => PERFORMERS[p]),
  }
}

// [title, released (days ago, or a date), cover, performers, tags, seconds].
// New Releases keeps releases dated within the last 48 hours and holds them
// until they are four days old. The two busy sites release today and
// yesterday, counted back from today so they never fall out of the window,
// plus one at three days (past 48 hours, inside four days) and older ones;
// Sleepy Sweets' releases are years old.
const SCENES = {
  [TPDB_SITES.lollipop.id]: [
    [
      'Lollipop Lullaby',
      0,
      'lollipop-lane',
      ['gigi', 'patti'],
      ['candy', 'pastel', 'sprinkles'],
      734,
    ],
    ['Cherry Cordial', 0, 'cherry-pop', ['bijou'], ['glossy', 'candy'], 1211],
    [
      'Rock Candy Rodeo',
      1,
      'sugar-rush',
      ['patti', 'belle'],
      ['retro', 'fizzy'],
      925,
    ],
    ['Sherbet Sunrise', 1, 'sweet-tooth', ['gigi'], ['pastel'], 1520],
    [
      'Gummy Bear Garden',
      1,
      'lollipop-lane',
      ['belle', 'coco'],
      ['bubblegum', 'candy'],
      1330,
    ],
    ['Taffy Pull', 3, 'cherry-pop', ['belle'], ['candy', 'sour'], 860],
    [
      'Candy Floss Clouds',
      9,
      'lollipop-lane',
      ['coco', 'gigi'],
      ['pastel', 'bubblegum'],
      1085,
    ],
  ],
  [TPDB_SITES.gumball.id]: [
    [
      'Gumball Galaxy',
      0,
      'sugar-rush',
      ['coco'],
      ['bubblegum', 'glossy'],
      1002,
    ],
    [
      'Bubble Trouble',
      0,
      'sweet-tooth',
      ['coco', 'patti'],
      ['bubblegum', 'fizzy'],
      1290,
    ],
    [
      'Sour Patch Party',
      1,
      'cherry-pop',
      ['belle', 'bijou'],
      ['sour', 'candy'],
      1404,
    ],
    ['Fizz Factor', 1, 'sugar-rush', ['patti'], ['fizzy', 'retro'], 980],
    ['Jawbreaker Jam', 3, 'lollipop-lane', ['patti'], ['retro'], 615],
    [
      'Chewing Gum Choir',
      12,
      'sugar-rush',
      ['gigi', 'coco'],
      ['bubblegum'],
      1150,
    ],
  ],
  [TPDB_SITES.sleepy.id]: [
    ['Sleepy Sundae', '2022-03-02', 'sweet-tooth', ['belle'], ['pastel'], 900],
    ['Nap Time Nougat', '2021-11-19', 'cherry-pop', ['patti'], ['retro'], 840],
  ],
}

const DOMAINS = {
  [TPDB_SITES.lollipop.id]: 'lollipop-lounge.example',
  [TPDB_SITES.gumball.id]: 'gumball-gallery.example',
  [TPDB_SITES.sleepy.id]: 'sleepy-sweets.example',
}

const sites = Object.values(TPDB_SITES)
export const TPDB_SCENES = Object.fromEntries(
  Object.entries(SCENES).map(([id, rows]) => {
    const site = sites.find((s) => String(s.id) === id)
    return [id, rows.map((row) => scene(site, DOMAINS[id], row))]
  }),
)

// Release dates as New Releases' task compares them: the day 48 hours (or
// 96) before now
const dayBefore = (hours) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 10)

// A site's scenes a first check keeps: those dated within the last 48 hours
export const tpdbFresh = (site) =>
  (TPDB_SCENES[site.id] || []).filter((s) => s.date >= dayBefore(48))

const requests = []
let inFlight = 0
let maxInFlight = 0

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

function answer(req, res, url) {
  const path = url.pathname.slice(TPDB_PREFIX.length)
  if (
    !/^Bearer \S+/.test(req.headers.authorization || '') ||
    /^Bearer invalid/.test(req.headers.authorization)
  )
    return json(res, 401, { message: 'Unauthenticated.' })
  const site = /^\/sites\/([^/]+)$/.exec(path)
  if (req.method === 'GET' && site) {
    const found = sites.find((s) => s.uuid === decodeURIComponent(site[1]))
    if (!found) return json(res, 404, { message: 'Not Found' })
    return json(res, 200, {
      data: { id: found.id, uuid: found.uuid, name: found.name },
    })
  }
  if (req.method === 'GET' && path === '/scenes') {
    const id = url.searchParams.get('site_id')
    const failing = FAILING[id]
    if (failing === 'challenge') {
      res.writeHead(403, {
        'Content-Type': 'text/html; charset=UTF-8',
        'cf-mitigated': 'challenge',
      })
      return res.end('<!DOCTYPE html><title>Just a moment...</title>')
    }
    if (failing) return json(res, failing, { message: 'Too Many Attempts.' })
    const perPage = Number(url.searchParams.get('per_page') || 15)
    return json(res, 200, {
      data: (TPDB_SCENES[id] || []).slice(0, perPage),
      meta: {
        current_page: 1,
        per_page: perPage,
        total: (TPDB_SCENES[id] || []).length,
      },
    })
  }
  return json(res, 404, { message: 'Not Found' })
}

/**
 * Handles a request under /tpdb/ and returns true, or returns false for
 * any other path. Slow on purpose (`delay` ms), so overlapping requests
 * would show in the log's maxInFlight.
 */
export function handleTpdb(req, res, { delay = 30 } = {}) {
  const url = new URL(req.url, 'http://x')
  if (
    url.pathname !== TPDB_PREFIX &&
    !url.pathname.startsWith(`${TPDB_PREFIX}/`)
  )
    return false
  if (url.pathname === `${TPDB_PREFIX}/_requests`) {
    if (req.method === 'DELETE') {
      requests.length = 0
      maxInFlight = 0
      res.writeHead(204).end()
    } else json(res, 200, { requests, maxInFlight })
    return true
  }
  const entry = {
    method: req.method,
    path: url.pathname.slice(TPDB_PREFIX.length),
    query: url.search,
    userAgent: req.headers['user-agent'] || '',
    authorization: req.headers.authorization || '',
    start: Date.now(),
  }
  requests.push(entry)
  inFlight += 1
  maxInFlight = Math.max(maxInFlight, inFlight)
  setTimeout(() => {
    inFlight -= 1
    entry.end = Date.now()
    answer(req, res, url)
  }, delay)
  return true
}
