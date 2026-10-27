// Tag Candy's tests run on a Stash of their own, so Apply icons never changes
// the tag images the other plugins' screenshots show. It starts from the
// binary tests/stash/stash.sh downloaded for the leg into WORK/bin, in a
// folder of its own, with a folder served at /custom/tagcandy-overrides/, and
// an HTTP server on the side stands in for the icons on the site and for a
// web address of overrides, with a folder under /locked/ that answers 401.
// Env: WORK (default stash-work), TAGCANDY_PORT (default 9961; the icon
// server takes the next port).
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, openSync } from 'node:fs'
import { appendFile, cp, mkdir, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(here, '..', '..', '..')
export const PLUGIN = resolve(here, '..')
const WORK = resolve(ROOT, process.env.WORK ?? 'stash-work')
const DIR = `${WORK}-tagcandy`
const PORT = Number(process.env.TAGCANDY_PORT ?? 9961)
export const TC = `http://127.0.0.1:${PORT}`
export const ICONS = `http://127.0.0.1:${PORT + 1}`
export const OVERRIDES_DIR = join(DIR, 'overrides')
const BINARY = join(
  WORK,
  'bin',
  process.platform === 'darwin' ? 'stash-macos' : 'stash-linux',
)
export const available = () => existsSync(BINARY)
export const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let child = null
let server = null
const auth = { cookie: '', key: '' }

const busy = (port) =>
  new Promise((done) => {
    const s = connect(port, '127.0.0.1')
    s.once('connect', () => (s.destroy(), done(true)))
    s.once('error', () => done(false))
  })

async function start() {
  // Another Stash on the port would answer the readiness check and take
  // every call meant for this one.
  if (await busy(PORT))
    throw new Error(`Port ${PORT} is in use; set TAGCANDY_PORT`)
  const log = openSync(join(DIR, 'stash.log'), 'a')
  child = spawn(
    BINARY,
    [
      '--config',
      join(DIR, 'config', 'config.yml'),
      '--host',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--nobrowser',
    ],
    { stdio: ['ignore', log, log] },
  )
  for (let i = 0; i < 60; i++) {
    try {
      const { systemStatus } = await gql(
        '{ systemStatus { status configPath } }',
      )
      if (
        resolve(
          systemStatus.configPath ?? join(DIR, 'config', 'config.yml'),
        ) !== join(DIR, 'config', 'config.yml')
      )
        throw new Error(`The Stash on ${PORT} is not this test's`)
      return systemStatus.status
    } catch (e) {
      if (/not this test's/.test(e.message)) throw e
      await sleep(500)
    }
  }
  throw new Error('Tag Candy test Stash did not start')
}

async function stop() {
  if (!child) return
  const exited = new Promise((r) => child.once('exit', r))
  child.kill()
  await exited
  child = null
}

export async function gql(query, variables = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth.key) headers.ApiKey = auth.key
  else if (auth.cookie) headers.Cookie = auth.cookie
  const res = await fetch(`${TC}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

// Turns on a password, logs in and generates an API key when asked to.
export async function lock({ withKey }) {
  await gql(
    'mutation { configureGeneral(input: { username: "tester", password: "candy-test" }) { username } }',
  )
  const res = await fetch(`${TC}/login`, {
    method: 'POST',
    body: new URLSearchParams({ username: 'tester', password: 'candy-test' }),
    redirect: 'manual',
  })
  auth.cookie = (
    res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]
  )
    .map((c) => c.split(';')[0])
    .join('; ')
  if (withKey) {
    auth.key = (
      await gql('mutation { generateAPIKey(input: {}) }')
    ).generateAPIKey
  }
  return auth.key
}

export const settings = (input) =>
  gql(
    'mutation ($i: Map!) { configurePlugin(plugin_id: "TagCandy", input: $i) }',
    {
      i: { iconBaseUrl: `${ICONS}/icons/`, ...input },
    },
  )

export const createTag = async (input) =>
  (
    await gql(
      'mutation ($i: TagCreateInput!) { tagCreate(input: $i) { id name } }',
      { i: input },
    )
  ).tagCreate

export const updateTag = (input) =>
  gql('mutation ($i: TagUpdateInput!) { tagUpdate(input: $i) { id } }', {
    i: input,
  })

export const findTag = async (id) =>
  (
    await gql(
      'query ($id: ID!) { findTag(id: $id) { id name image_path updated_at custom_fields parents { name } } }',
      { id },
    )
  ).findTag

export async function findByName(name) {
  const { findTags } = await gql(
    'query ($n: String!) { findTags(tag_filter: { name: { value: $n, modifier: EQUALS } }) { tags { id name custom_fields parents { name } } } }',
    { n: name },
  )
  return findTags.tags[0] ?? null
}

// The SHA-256 of a tag's image, or null when it has none.
export async function imageHash(id) {
  const tag = await findTag(id)
  if (!tag || /default=true/.test(tag.image_path)) return null
  const headers = auth.key
    ? { ApiKey: auth.key }
    : auth.cookie
      ? { Cookie: auth.cookie }
      : {}
  const res = await fetch(`${TC}/tag/${id}/image`, { headers })
  return sha256(Buffer.from(await res.arrayBuffer()))
}

export const dataUri = (bytes, type = 'image/webp') =>
  `data:${type};base64,${Buffer.from(bytes).toString('base64')}`

export const iconBytes = (file) => readFile(join(PLUGIN, 'icons', file))

// Runs a Tag Candy task and returns its log lines, newest last.
export async function runTask(name) {
  const since = Date.now() - 1000
  const id = (
    await gql(
      'mutation ($t: String!) { runPluginTask(plugin_id: "TagCandy", task_name: $t) }',
      { t: name },
    )
  ).runPluginTask
  for (let i = 0; i < 240; i++) {
    const { findJob } = await gql(
      'query ($i: FindJobInput!) { findJob(input: $i) { status error } }',
      { i: { id } },
    )
    if (
      !findJob ||
      ['FINISHED', 'FAILED', 'CANCELLED'].includes(findJob.status)
    ) {
      if (findJob?.status === 'FAILED')
        throw new Error(`${name} failed: ${findJob.error}`)
      break
    }
    await sleep(250)
  }
  return logLines(since)
}

export async function logLines(since = 0) {
  const { logs } = await gql('{ logs { time level message } }')
  return logs
    .filter(
      (l) =>
        Date.parse(l.time) >= since &&
        l.message.includes('[Plugin / Tag Candy]'),
    )
    .map((l) => l.message.replace(/^\[Plugin \/ Tag Candy\] /, ''))
    .reverse()
}

export const allLogs = async () =>
  (await gql('{ logs { message } }')).logs.map((l) => l.message)

// Installs the built plugin, or a script built from a changed bundle.
export async function installScript(
  file = join(ROOT, 'dist', 'site', 'TagCandy', 'tagcandy.js'),
) {
  const dir = join(DIR, 'config', 'plugins', 'TagCandy')
  await mkdir(dir, { recursive: true })
  await cp(
    join(ROOT, 'dist', 'site', 'TagCandy', 'TagCandy.yml'),
    join(dir, 'TagCandy.yml'),
  )
  await cp(file, join(dir, 'tagcandy.js'))
  await gql('mutation { reloadPlugins }')
  const { plugins } = await gql('{ plugins { id enabled } }')
  if (!plugins?.some((p) => p.id === 'TagCandy' && p.enabled))
    throw new Error('Tag Candy did not load; see the test Stash log')
}

function serveIcons() {
  const roots = { icons: join(PLUGIN, 'icons'), overrides: OVERRIDES_DIR }
  server = createServer((req, res) => {
    const [, folder, file] = req.url.split('?')[0].split('/')
    if (folder === 'locked') return res.writeHead(401).end()
    const path =
      roots[folder] && file && !file.includes('..')
        ? join(roots[folder], file)
        : null
    if (!path || !existsSync(path)) return res.writeHead(404).end()
    res.writeHead(200, { 'Content-Type': 'image/webp' })
    createReadStream(path).pipe(res)
  })
  return new Promise((r) => server.listen(PORT + 1, '127.0.0.1', r))
}

export async function setUp() {
  await rm(DIR, { recursive: true, force: true })
  await mkdir(join(DIR, 'config'), { recursive: true })
  await mkdir(join(DIR, 'library'), { recursive: true })
  await mkdir(OVERRIDES_DIR, { recursive: true })
  await start()
  const config = join(DIR, 'config')
  await gql('mutation ($i: SetupInput!) { setup(input: $i) }', {
    i: {
      configLocation: join(config, 'config.yml'),
      stashes: [
        {
          path: join(DIR, 'library'),
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
  await gql(
    'mutation ($p: String!) { configureGeneral(input: { pluginsPath: $p }) { pluginsPath } }',
    {
      p: join(config, 'plugins'),
    },
  )
  await gql('mutation { configureUI(partial: { lastNoteSeen: 99999999 }) }')
  // custom_served_folders is read from config.yml at start only.
  await stop()
  await appendFile(
    join(config, 'config.yml'),
    `custom_served_folders:\n  /tagcandy-overrides: ${OVERRIDES_DIR}\n`,
  )
  await start()
  await installScript()
  await serveIcons()
  await settings({})
}

export async function tearDown() {
  await stop()
  await new Promise((r) => (server ? server.close(r) : r()))
}
