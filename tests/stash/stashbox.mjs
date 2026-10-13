// A stand-in stash-box for the compatibility tests. prepare.mjs points Stash
// at it, Stash sends it the stash-box queries a real service would get, and it
// answers from the invented catalogue in stashbox-data.mjs, so the Tagger, the
// stash-box scrape dialogs and StashID links render without a real service.
// Playwright starts it (playwright.config.mjs); `node tests/stash/stashbox.mjs`
// runs it by hand. Env: STASH_BOX_PORT (default 9998).
import { createServer } from 'node:http'
import { renderStickers } from './stickers.mjs'
import { IMAGES, STASH_BOX_PORT, catalogue } from './stashbox-data.mjs'

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

function graphql(body) {
  const name =
    body.operationName ||
    /^\s*(?:query|mutation)\s+(\w+)/m.exec(body.query ?? '')?.[1]
  const resolve = resolvers[name]
  if (!resolve) {
    console.error(
      `stash-box mock: no answer for ${name ?? 'an anonymous query'}`,
    )
    return { errors: [{ message: `Unsupported operation ${name}` }] }
  }
  return { data: resolve(body.variables ?? {}) }
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x')
  if (req.method === 'POST' && pathname === '/graphql') {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      let reply
      try {
        reply = graphql(JSON.parse(raw))
      } catch (error) {
        reply = { errors: [{ message: String(error) }] }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
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
