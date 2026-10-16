// The parts of the build that every plugin shares: finding the plugins,
// building each one's folder and reproducible zip, and writing the plugin
// source. Changes here can alter every zip, so build.mjs dates each plugin
// from its last commit to this file as well as to the plugin's own inputs.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  cp,
  mkdir,
  readdir,
  readFile,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { landing } from './landing.mjs'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shared = ['LICENSE', 'scripts/build.mjs', 'scripts/site.mjs']

// Every folder under plugins/ with a plugin.mjs, sorted by folder name.
export async function listPlugins(base = root) {
  const dirs = (await readdir(join(base, 'plugins'), { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(base, 'plugins', name, 'plugin.mjs')))
    .sort()
  return Promise.all(
    dirs.map(async (name) => ({
      name,
      dir: join(base, 'plugins', name),
      mod: await import(
        pathToFileURL(join(base, 'plugins', name, 'plugin.mjs')).href
      ),
    })),
  )
}

// Builds <site>/<id>/ and <site>/<id>.zip for one plugin and returns its entry
// in the plugin source.
export async function buildPlugin(site, { name, dir, mod }) {
  const { id } = mod
  const out = join(site, id)
  await mkdir(out, { recursive: true })
  await mod.build(out)
  // A plugin with a LICENSE of its own ships that one, the rest the repo's.
  const ownLicense = join(dir, 'LICENSE')
  await cp(
    existsSync(ownLicense) ? ownLicense : join(root, 'LICENSE'),
    join(out, 'LICENSE'),
  )

  // Stash offers an update when `date` moves forward; `version` is display only.
  // Both come from the last commit that changed what goes into the zip, so a
  // rebuild with no plugin changes offers no update.
  const inputs = [
    ...mod.inputs.map((p) => relative(root, join(dir, p))),
    ...shared,
  ]
  const [commit, epoch] = execFileSync(
    'git',
    ['log', '-1', '--format=%h %ct', '--', ...inputs],
    { cwd: root },
  )
    .toString()
    .trim()
    .split(' ')

  // A reproducible zip: every file stamped with that commit's time and added
  // in sorted order, with no directory entries or extra attributes. Any build
  // of the same commit gives the same bytes, so the GitHub Release asset and
  // the file the plugin source serves share one sha256.
  const files = (await readdir(out, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => relative(out, join(e.parentPath, e.name)))
    .sort()
  const stamp = new Date(Number(epoch) * 1000)
  await Promise.all(files.map((f) => utimes(join(out, f), stamp, stamp)))
  const zip = join(site, `${id}.zip`)
  execFileSync('zip', ['-q', '-X', '-D', zip, ...files], {
    cwd: out,
    env: { ...process.env, TZ: 'UTC' },
  })
  const sha256 = createHash('sha256')
    .update(await readFile(zip))
    .digest('hex')

  const manifest = await readFile(join(out, `${id}.yml`), 'utf8')
  const field = (key) => manifest.match(new RegExp(`^${key}: (.*)$`, 'm'))?.[1]
  const entry = {
    id,
    name: field('name'),
    description: field('description'),
    version: `${field('version')}-${commit}`,
    date: stamp.toISOString().replace('T', ' ').slice(0, 19),
    path: `${id}.zip`,
    sha256,
    folder: name,
    title: mod.title,
    legacy: Boolean(mod.legacySource),
    pages: Boolean(mod.pages),
  }

  if (mod.pages) {
    await mkdir(join(site, name), { recursive: true })
    await mod.pages(join(site, name), out)
  }
  if (entry.legacy) {
    await mkdir(join(site, name), { recursive: true })
    await cp(zip, join(site, name, `${id}.zip`))
    await writeFile(join(site, name, 'index.yml'), indexYml([entry]))
  }
  return entry
}

// The Stash plugin source format. JSON strings are valid YAML, so a ': ' in a
// name or description can't break the index.
export function indexYml(entries) {
  return entries
    .map((e) =>
      [
        `- id: ${e.id}`,
        `  name: ${JSON.stringify(e.name)}`,
        `  metadata:`,
        `    description: ${JSON.stringify(e.description)}`,
        `  version: ${e.version}`,
        `  date: ${e.date}`,
        `  path: ${e.path}`,
        `  sha256: ${e.sha256}`,
        '',
      ].join('\n'),
    )
    .join('')
}

// The shared source and its landing page, listing every built plugin.
export async function writeSource(site, entries) {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id))
  await writeFile(join(site, 'index.yml'), indexYml(sorted))
  await writeFile(join(site, 'index.html'), landing(sorted))
}
