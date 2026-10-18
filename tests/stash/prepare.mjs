// Prepares a fresh Stash for the compatibility tests: runs setup, scans the
// demo clips and stills, seeds invented studios, tags, performers and a
// gallery, points Stash at the
// mock stash-box (stashbox.mjs) and links a few of them to it, then installs
// the plugins under test from a locally served copy of the plugin source, the
// way users install them.
//
// Env: STASH_URL (default http://127.0.0.1:9999), WORK (the folder stash.sh
// used), SITE (default dist/site), PLUGINS (plugin IDs to install, comma
// separated, default every plugin in SITE's index.yml), COMPANIONS (other
// authors' plugins to install beside them, companions.mjs, from the copies of
// their zips in COMPANION_ZIPS, companion-zips.mjs), PW_CHANNEL (optional
// Playwright channel). The plugins the themes restyle (RESTYLED in
// companions.mjs) are always installed, and left switched off.
import { createReadStream } from 'node:fs'
import { cp, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { BOX_NAME, ENDPOINT, LINKS } from './stashbox-data.mjs'
import {
  fetchCompanionZips,
  fetchRestyledFiles,
  restyledDir,
  zipFile,
} from './companion-zips.mjs'
import { companionIndex, companions, restyled } from './companions.mjs'
import { renderStickers } from './stickers.mjs'

const STASH = process.env.STASH_URL ?? 'http://127.0.0.1:9999'
const WORK = resolve(process.env.WORK ?? 'stash-work')
const SITE = resolve(process.env.SITE ?? 'dist/site')
const PLUGIN_IDS = process.env.PLUGINS
  ? process.env.PLUGINS.split(',')
  : Array.from(
      (await readFile(join(SITE, 'index.yml'), 'utf8')).matchAll(
        /^- id: (.+)$/gm,
      ),
      (m) => m[1],
    )
if (!PLUGIN_IDS.length)
  throw new Error(`No plugins listed in ${SITE}/index.yml`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function gql(query, variables = {}) {
  const res = await fetch(`${STASH}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

async function waitForJobs() {
  for (let i = 0; i < 300; i++) {
    const { jobQueue } = await gql('{ jobQueue { id } }')
    if (!jobQueue?.length) return
    await sleep(1000)
  }
  throw new Error('Stash jobs did not finish')
}

async function setup() {
  const { systemStatus } = await gql('{ systemStatus { status } }')
  if (systemStatus.status === 'SETUP') {
    const config = join(WORK, 'config')
    await gql('mutation ($i: SetupInput!) { setup(input: $i) }', {
      i: {
        configLocation: join(config, 'config.yml'),
        stashes: [
          {
            path: join(WORK, 'library'),
            excludeVideo: false,
            excludeImage: false,
          },
        ],
        databaseFile: join(config, 'stash-go.sqlite'),
        generatedLocation: join(config, 'generated'),
        cacheLocation: join(config, 'cache'),
        blobsLocation: join(config, 'blobs'),
        storeBlobsInDatabase: false,
      },
    })
  }
  // Keep the release-notes dialog from covering every page.
  await gql('mutation { configureUI(partial: { lastNoteSeen: 99999999 }) }')
  await gql(`mutation { metadataScan(input: {
    scanGenerateCovers: true, scanGeneratePreviews: true,
    scanGenerateSprites: true, scanGenerateThumbnails: true }) }`)
  await waitForJobs()
}

// Performer portraits: Juicy's own stickers on candy gradients.
async function portraits() {
  const pngs = await renderStickers(
    [
      ['mascot', '#ffd6ec', '#fc68b2'],
      ['cherry', '#fff3c4', '#fdda4e'],
      ['lips', '#e9d6ff', '#9b30ff'],
      ['crown', '#eaffc2', '#d7fa54'],
      ['heart-lock', '#d4f1ff', '#00a8f0'],
      ['bubble', '#ffe0f0', '#dd2a97'],
    ].map(([icon, from, to]) => ({
      key: icon,
      icon,
      from,
      to,
      width: 400,
      height: 600,
      size: 300,
    })),
  )
  return Object.fromEntries(
    Object.entries(pngs).map(([icon, png]) => [
      icon,
      `data:image/png;base64,${png.toString('base64')}`,
    ]),
  )
}

async function seed() {
  const create = async (kind, input) =>
    (
      await gql(
        `mutation ($i: ${kind}CreateInput!) { ${kind.toLowerCase()}Create(input: $i) { id } }`,
        { i: input },
      )
    )[`${kind.toLowerCase()}Create`].id

  const studios = []
  for (const name of ['Pop Club', 'Sugar Shack', 'Midnight Candy Co.']) {
    studios.push(await create('Studio', { name }))
  }
  const tags = []
  for (const name of ['Candy', 'Glossy', 'Pastel', 'Sparkle', 'Retro']) {
    tags.push(await create('Tag', { name }))
  }
  const images = await portraits()
  const performers = []
  for (const [name, icon, favorite, rating100] of [
    ['Gumdrop Gigi', 'mascot', true, 100],
    ['Sherbet Sparks', 'cherry', false, 80],
    ['Bonbon Bijou', 'lips', true, 90],
    ['Taffy Twinkle', 'crown', false, 60],
    ['Praline Pixie', 'heart-lock', false, 70],
    ['Licorice Lux', 'bubble', false, 40],
  ]) {
    performers.push(
      await create('Performer', {
        name,
        image: images[icon],
        favorite,
        rating100,
      }),
    )
  }

  const { findScenes } = await gql(
    '{ findScenes(filter: { per_page: -1, sort: "path" }) { scenes { id files { basename } } } }',
  )
  for (const [n, scene] of findScenes.scenes.entries()) {
    const base = scene.files[0].basename.replace(/\.\w+$/, '')
    await gql(
      'mutation ($i: SceneUpdateInput!) { sceneUpdate(input: $i) { id } }',
      {
        i: {
          id: scene.id,
          title: base
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          date: `2026-0${1 + (n % 9)}-${String(10 + n).padStart(2, '0')}`,
          rating100: [100, 80, 60, 90, 40, 70, 20, 100][n % 8],
          studio_id: studios[n % studios.length],
          performer_ids: [
            performers[n % performers.length],
            performers[(n + 2) % performers.length],
          ],
          tag_ids: [tags[n % tags.length], tags[(n + 2) % tags.length]],
          organized: n % 3 === 0,
          details: 'A demo clip made from an ffmpeg test pattern.',
        },
      },
    )
    for (let i = 0; i < n % 4; i++) {
      await gql('mutation ($id: ID!) { sceneAddO(id: $id) { count } }', {
        id: scene.id,
      })
    }
  }

  const gallery = await create('Gallery', {
    title: 'Sweet Stills',
    studio_id: studios[0],
    performer_ids: [performers[0], performers[2]],
    rating100: 80,
  })
  const { findImages } = await gql(
    '{ findImages(filter: { per_page: -1, sort: "path" }) { images { id } } }',
  )
  for (const [n, image] of findImages.images.entries()) {
    await gql(
      'mutation ($i: ImageUpdateInput!) { imageUpdate(input: $i) { id } }',
      {
        i: {
          id: image.id,
          gallery_ids: [gallery],
          performer_ids: [performers[n % performers.length]],
          rating100: [100, null, 80, null, 60, null][n % 6],
        },
      },
    )
  }
  console.log(
    `Seeded ${studios.length} studios, ${tags.length} tags, ${performers.length} performers, ${findScenes.scenes.length} scenes, ${findImages.images.length} images in a gallery`,
  )
}

// Registers the mock stash-box and gives the entities in LINKS a StashID on
// it, so detail pages show StashID links and the Tagger shows linked entities.
// Stash only stores the endpoint here; the mock runs during the tests.
async function stashBox() {
  await gql(
    `mutation ($b: [StashBoxInput!]) {
      configureGeneral(input: { stashBoxes: $b }) { stashBoxes { endpoint } } }`,
    { b: [{ name: BOX_NAME, endpoint: ENDPOINT, api_key: 'demo' }] },
  )
  const { findPerformers, findStudios, findTags, findScenes } = await gql(`{
    findPerformers(filter: { per_page: -1 }) { performers { id name } }
    findStudios(filter: { per_page: -1 }) { studios { id name } }
    findTags(filter: { per_page: -1 }) { tags { id name } }
    findScenes(filter: { per_page: -1 }) { scenes { id title } }
  }`)
  const kinds = [
    ['Performer', 'performers', findPerformers.performers, 'name'],
    ['Studio', 'studios', findStudios.studios, 'name'],
    ['Tag', 'tags', findTags.tags, 'name'],
    ['Scene', 'scenes', findScenes.scenes, 'title'],
  ]
  for (const [kind, key, local, field] of kinds) {
    for (const [name, stashId] of LINKS[key]) {
      const { id } = local.find((x) => x[field] === name)
      await gql(
        `mutation ($i: ${kind}UpdateInput!) { ${kind.toLowerCase()}Update(input: $i) { id } }`,
        { i: { id, stash_ids: [{ endpoint: ENDPOINT, stash_id: stashId }] } },
      )
    }
  }
  console.log(`Linked the demo library to ${BOX_NAME} at ${ENDPOINT}`)
}

const TYPES = { '.yml': 'text/yaml', '.zip': 'application/zip' }

async function install() {
  const extra = companions()
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    // The companions' source: their pinned packages, whose zips are the
    // copies companion-zips.mjs keeps
    if (path === '/companions/index.yml') {
      res.writeHead(200, { 'Content-Type': TYPES['.yml'] })
      res.end(companionIndex(`${origin}/companions`))
      return
    }
    const zip = extra.find(
      (c) => path === `/companions/${c.package.sha256}.zip`,
    )
    const file = zip ? zipFile(zip.package) : join(SITE, path)
    try {
      if (!(zip || file.startsWith(SITE)) || !(await stat(file)).isFile())
        throw new Error()
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      })
      createReadStream(file).pipe(res)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`
  const source = `${origin}/index.yml`
  const extraSource = `${origin}/companions/index.yml`

  await gql(
    `mutation ($s: [PackageSourceInput!]) {
      configureGeneral(input: { pluginPackageSources: $s }) { pluginPackageSources { url } } }`,
    {
      s: [
        { name: 'CandyBoudoir', url: source, local_path: 'candyboudoir' },
        ...(extra.length
          ? [{ name: 'Companions', url: extraSource, local_path: 'companions' }]
          : []),
      ],
    },
  )
  await gql(
    'mutation ($p: [PackageSpecInput!]!) { installPackages(type: Plugin, packages: $p) }',
    {
      p: [
        ...PLUGIN_IDS.map((id) => ({ id, sourceURL: source })),
        ...extra.map((c) => ({ id: c.package.id, sourceURL: extraSource })),
      ],
    },
  )
  const wanted = [...PLUGIN_IDS, ...extra.flatMap((c) => c.enable)]
  let installed = []
  for (let i = 0; i < 90 && installed.length < wanted.length; i++) {
    await sleep(1000)
    const { plugins } = await gql('{ plugins { id version enabled } }')
    installed = (plugins ?? []).filter(
      (p) => wanted.includes(p.id) && p.enabled,
    )
  }
  server.close()
  if (installed.length < wanted.length)
    throw new Error(
      `${wanted.join(', ')} did not install from the plugin source`,
    )
  // Builds a companion ships that must not run beside the one under test
  const off = extra.flatMap((c) => c.disable)
  if (off.length)
    await gql('mutation ($m: BoolMap!) { setPluginsEnabled(enabledMap: $m) }', {
      m: Object.fromEntries(off.map((id) => [id, false])),
    })
  for (const p of installed)
    console.log(
      `Installed ${p.id} ${p.version} from ${PLUGIN_IDS.includes(p.id) ? source : extraSource}`,
    )
}

// The plugins the themes restyle: their pinned files go straight into
// Stash's plugins folder, since they come from the author's repository and
// not from a plugin source, and stay switched off until a theme's specs
// switch one on
async function installRestyled() {
  const list = restyled()
  if (!list.length) return
  const { configuration } = await gql(
    '{ configuration { general { pluginsPath } } }',
  )
  for (const r of list)
    await cp(restyledDir(r), join(configuration.general.pluginsPath, r.id), {
      recursive: true,
    })
  await gql('mutation { reloadPlugins }')
  await gql('mutation ($m: BoolMap!) { setPluginsEnabled(enabledMap: $m) }', {
    m: Object.fromEntries(list.map((r) => [r.id, false])),
  })
  const { plugins } = await gql('{ plugins { id version } }')
  for (const r of list) {
    const p = plugins.find((p) => p.id === r.id)
    if (!p) throw new Error(`${r.name} did not load from its pinned files`)
    console.log(`Installed ${p.id} ${p.version} from ${r.base}`)
  }
}

await fetchCompanionZips()
await fetchRestyledFiles()
await setup()
await seed()
await stashBox()
await install()
await installRestyled()
