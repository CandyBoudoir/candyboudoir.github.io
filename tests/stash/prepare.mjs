// Prepares a fresh Stash for the compatibility tests: runs setup, scans the
// demo clips, seeds invented studios, tags and performers, then installs Juicy
// from a locally served copy of the plugin source, the way users install it.
//
// Env: STASH_URL (default http://127.0.0.1:9999), WORK (the folder stash.sh
// used), SITE (default dist/site), PW_CHANNEL (optional Playwright channel).
import { chromium } from '@playwright/test'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

const STASH = process.env.STASH_URL ?? 'http://127.0.0.1:9999'
const WORK = resolve(process.env.WORK ?? 'stash-work')
const SITE = resolve(process.env.SITE ?? 'dist/site')
const ICONS = resolve('src/icons')
const PLUGIN_ID = 'Theme-Juicy'

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
            excludeImage: true,
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
  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL || undefined,
  })
  const page = await browser.newPage({ viewport: { width: 400, height: 600 } })
  const out = {}
  for (const [icon, from, to] of [
    ['mascot', '#ffd6ec', '#fc68b2'],
    ['cherry', '#fff3c4', '#fdda4e'],
    ['lips', '#e9d6ff', '#9b30ff'],
    ['crown', '#eaffc2', '#d7fa54'],
    ['heart-lock', '#d4f1ff', '#00a8f0'],
    ['bubble', '#ffe0f0', '#dd2a97'],
  ]) {
    const svg = await readFile(join(ICONS, `${icon}.svg`), 'utf8')
    await page.setContent(
      `<body style="margin:0;height:600px;display:grid;place-items:center;
        background:radial-gradient(circle at 30% 25%, ${from}, ${to})">
        <div style="width:300px;height:300px">${svg}</div></body>`,
    )
    const png = await page.screenshot()
    out[icon] = `data:image/png;base64,${png.toString('base64')}`
  }
  await browser.close()
  return out
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
  console.log(
    `Seeded ${studios.length} studios, ${tags.length} tags, ${performers.length} performers, ${findScenes.scenes.length} scenes`,
  )
}

const TYPES = { '.yml': 'text/yaml', '.zip': 'application/zip' }

async function install() {
  const server = createServer(async (req, res) => {
    const file = join(
      SITE,
      decodeURIComponent(new URL(req.url, 'http://x').pathname),
    )
    try {
      if (!file.startsWith(SITE) || !(await stat(file)).isFile())
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
  const source = `http://127.0.0.1:${server.address().port}/index.yml`

  await gql(
    `mutation ($s: [PackageSourceInput!]) {
      configureGeneral(input: { pluginPackageSources: $s }) { pluginPackageSources { url } } }`,
    { s: [{ name: 'Juicy', url: source, local_path: 'juicy' }] },
  )
  await gql(
    'mutation ($p: [PackageSpecInput!]!) { installPackages(type: Plugin, packages: $p) }',
    { p: [{ id: PLUGIN_ID, sourceURL: source }] },
  )
  let plugin
  for (let i = 0; i < 60 && !plugin; i++) {
    await sleep(1000)
    const { plugins } = await gql('{ plugins { id version enabled } }')
    plugin = plugins?.find((p) => p.id === PLUGIN_ID && p.enabled)
  }
  server.close()
  if (!plugin) throw new Error('Juicy did not install from the plugin source')
  console.log(`Installed ${PLUGIN_ID} ${plugin.version} from ${source}`)
}

await setup()
await seed()
await install()
