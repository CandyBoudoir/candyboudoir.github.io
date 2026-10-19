// A stand-in stash-box for the compatibility tests. prepare.mjs points Stash
// at it, Stash sends it the stash-box queries a real service would get, and it
// answers from the invented catalogue in stashbox-data.mjs, so the Tagger, the
// stash-box scrape dialogs and StashID links render without a real service.
// It also stands in for StashDB for Cherry Pick's StashDB layer, which sends
// its own queries from the browser (queryScenes by performer or studio in
// popularity order, findScene by id with fingerprint submissions); those are
// answered from the separate StashDB catalogue, with StashDB's CORS headers.
// Under /tpdb/ it also stands in for ThePornDB's REST API (theporndb.mjs),
// for New Releases. Playwright starts it (playwright.config.mjs); `node
// tests/stash/stashbox.mjs` runs it by hand. Env: STASH_BOX_PORT (default
// 9998).
import { createServer } from 'node:http'
import { renderStickers } from './stickers.mjs'
import {
  IMAGES,
  REFUSED_KEY,
  STASH_BOX_PORT,
  STASHDB,
  catalogue,
} from './stashbox-data.mjs'
import { handleTpdb } from './theporndb.mjs'

const { scenes, performers, studios, tags } = catalogue
const images = await renderStickers(IMAGES)

// Best matches first, and never empty, so every search has results to show.
function rank(list, term = '', key = 'name') {
  const t = String(term).toLowerCase()
  const score = (x) => {
    const v = x[key].toLowerCase()
    return v === t ? 0 : v.includes(t) || t.includes(v) ? 1 : 2
  }
  return [...list].sort((a, b) => score(a) - score(b)).slice(0, 3)
}

const named = (list, name) =>
  list.find((x) => x.name.toLowerCase() === String(name).toLowerCase())

// StashDB's answers carry no hidden fields.
const publicScene = (scene) =>
  Object.fromEntries(Object.entries(scene).filter(([k]) => k !== 'popularity'))

// queryScenes: scenes with any of the given performers and studios, sorted
// as StashDB sorts them (POPULARITY: most users first, then newest id).
function queryScenes(input = {}) {
  const ids = (c) => (c?.value?.length ? new Set(c.value) : null)
  const performers = ids(input.performers)
  const studios = ids(input.studios)
  const order = {
    POPULARITY: (a, b) => b.popularity - a.popularity || (a.id < b.id ? 1 : -1),
    DATE: (a, b) => b.release_date.localeCompare(a.release_date),
    TITLE: (a, b) => b.title.localeCompare(a.title),
  }[input.sort ?? 'DATE']
  const list = STASHDB.scenes
    .filter(
      (s) =>
        (!performers ||
          s.performers.some((p) => performers.has(p.performer.id))) &&
        (!studios || studios.has(s.studio?.id)),
    )
    .sort(order ?? (() => 0))
  if (input.direction === 'ASC') list.reverse()
  const perPage = input.per_page ?? 25
  const start = ((input.page ?? 1) - 1) * perPage
  return {
    count: list.length,
    scenes: list.slice(start, start + perPage).map(publicScene),
  }
}

// The StashDB root fields Cherry Pick asks for, by alias:
// `s0: findScene(id: $s0)` and `queryScenes(input: $input)`.
function stashdbFields(query, variables) {
  const data = {}
  for (const [, alias, name, arg] of query.matchAll(
    /(?:(\w+)\s*:\s*)?\b(findScene|queryScenes)\s*\(\s*\w+\s*:\s*\$(\w+)\s*\)/g,
  )) {
    const value = variables[arg]
    const scene =
      name === 'findScene' ? STASHDB.scenes.find((x) => x.id === value) : null
    data[alias ?? name] =
      name === 'queryScenes'
        ? queryScenes(value)
        : scene
          ? publicScene(scene)
          : null
  }
  return Object.keys(data).length ? data : null
}

const resolvers = {
  Me: () => ({ me: { name: 'candy' } }),
  SearchScene: ({ term }) => ({ searchScene: rank(scenes, term, 'title') }),
  // One list per scene queried. Every fourth comes back empty, the others
  // carry the queried fingerprints so Stash reports them as matches.
  FindScenesBySceneFingerprints: ({ fingerprints }) => ({
    findScenesBySceneFingerprints: fingerprints.map((fps, i) =>
      i % 4 === 3
        ? []
        : [
            {
              ...scenes[i % scenes.length],
              fingerprints: fps.map((f) => ({
                algorithm: f.algorithm,
                hash: f.hash,
                duration: 8,
              })),
            },
          ],
    ),
  }),
  SearchPerformer: ({ term }) => ({ searchPerformer: rank(performers, term) }),
  FindPerformerByID: ({ id }) => ({
    findPerformer: performers.find((p) => p.id === id) ?? null,
  }),
  FindSceneByID: ({ id }) => ({
    findScene: scenes.find((s) => s.id === id) ?? null,
  }),
  FindStudio: ({ id, name }) => ({
    findStudio:
      studios.find((s) => s.id === id) ??
      (name ? named(studios, name) : null) ??
      null,
  }),
  FindTag: ({ id, name }) => ({
    findTag:
      tags.find((t) => t.id === id) ??
      (name ? named(tags, name) : null) ??
      null,
  }),
  QueryTags: ({ input }) => {
    const hits = rank(tags, input?.name ?? input?.names?.[0] ?? '')
    return { queryTags: { count: hits.length, tags: hits } }
  },
  SubmitFingerprint: () => ({ submitFingerprint: true }),
  SubmitSceneDraft: () => ({ submitSceneDraft: { id: 'draft-scene' } }),
  SubmitPerformerDraft: () => ({
    submitPerformerDraft: { id: 'draft-performer' },
  }),
}

function graphql(body, apiKey) {
  // A refused key fails as StashDB fails an expired one; Stash reports it
  // as "Invalid or expired API key."
  if (REFUSED_KEY.test(apiKey ?? ''))
    return { errors: [{ message: 'token signature is invalid' }] }
  const name =
    body.operationName ||
    /^\s*(?:query|mutation)\s+(\w+)/m.exec(body.query ?? '')?.[1]
  const resolve = resolvers[name]
  if (resolve) return { data: resolve(body.variables ?? {}) }
  const data = stashdbFields(body.query ?? '', body.variables ?? {})
  if (data) return { data }
  console.error(`stash-box mock: no answer for ${name ?? 'an anonymous query'}`)
  return { errors: [{ message: `Unsupported operation ${name}` }] }
}

// StashDB answers cross-origin requests from any page.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,apikey',
  'Access-Control-Allow-Methods': 'POST',
}

const server = createServer((req, res) => {
  if (handleTpdb(req, res)) return
  const { pathname } = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS' && pathname === '/graphql') {
    res.writeHead(204, CORS).end()
    return
  }
  if (req.method === 'POST' && pathname === '/graphql') {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      let reply
      try {
        reply = graphql(JSON.parse(raw), req.headers.apikey)
      } catch (error) {
        reply = { errors: [{ message: String(error) }] }
      }
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS })
      res.end(JSON.stringify(reply))
    })
    return
  }
  const png = /^\/images\/([\w-]+)\.png$/.exec(pathname)?.[1]
  if (req.method === 'GET' && images[png]) {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(images[png])
    return
  }
  if (pathname === '/health') {
    res.writeHead(200).end('ok')
    return
  }
  res.writeHead(404).end()
})

server.listen(STASH_BOX_PORT, '127.0.0.1', () =>
  console.log(`stash-box mock on http://127.0.0.1:${STASH_BOX_PORT}/graphql`),
)
