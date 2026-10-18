// Plugins that live in other CandyBoudoir repos but publish through this
// site's plugin source. plugins.external.json lists each one as
//   { "repo": "CandyBoudoir/<repo>", "folder": "<folder>",
//     "title": "<name>", "summary": "<README line>" }
// Such a repo is public and keeps this repo's layout and build: the plugin in
// plugins/<folder>/ and scripts/build.mjs writing dist/entries.json and
// dist/site/. Its own Publish workflow tags <folder>-vX.Y.Z and attaches the
// zip to that tag's GitHub Release. scripts/stable.mjs builds that tag here
// and checks the zip against the release, and `node scripts/external.mjs
// develop` adds each one's main to the develop channel built in dist/.
// EXTERNAL_GIT_BASE (default https://github.com) lets tests clone local repos.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { listPlugins, root, writeSource } from './site.mjs'

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

// The plugins listed in <base>/plugins.external.json, checked: each repo is
// a CandyBoudoir one, since the build runs its code, and no folder is listed
// twice or also kept in this repo.
export async function listExternal(base = root) {
  const file = join(base, 'plugins.external.json')
  if (!existsSync(file)) return []
  const list = JSON.parse(await readFile(file, 'utf8'))
  const local = (await listPlugins(base)).map((p) => p.name)
  const seen = new Set()
  for (const p of list) {
    if (!/^CandyBoudoir\/[\w.-]+$/.test(p.repo ?? ''))
      throw new Error(
        `plugins.external.json: ${p.repo} is not a CandyBoudoir repo`,
      )
    if (!/^[a-z0-9-]+$/.test(p.folder ?? ''))
      throw new Error(`plugins.external.json: bad folder ${p.folder}`)
    if (local.includes(p.folder) || seen.has(p.folder))
      throw new Error(
        `plugins.external.json: ${p.folder} is listed twice or kept in this repo too`,
      )
    if (!p.title || !p.summary)
      throw new Error(
        `plugins.external.json: ${p.folder} needs a title and summary`,
      )
    seen.add(p.folder)
  }
  return list
}

// The release tag to build a plugin from in a checkout: the one --tags pins
// for its folder, else its latest <folder>-vX.Y.Z reachable from HEAD, or
// undefined when it has none.
export function latestTag(dir, folder, pins = []) {
  return (
    pins.find((t) => t.startsWith(`${folder}-v`)) ??
    (git(
      dir,
      'tag',
      '--merged',
      'HEAD',
      '--list',
      `${folder}-v*`,
      '--sort=-version:refname',
    ).split('\n')[0] ||
      undefined)
  )
}

// Clones a repo's default branch, tags included, into a new temporary folder.
export async function clone(repo) {
  const dir = await mkdtemp(join(tmpdir(), `${repo.split('/')[1]}-`))
  const base = process.env.EXTERNAL_GIT_BASE ?? 'https://github.com'
  execFileSync('git', ['clone', '--quiet', `${base}/${repo}.git`, dir])
  return dir
}

// Builds the named plugins in a checkout with that checkout's own build and
// returns their entries from its dist/entries.json.
export async function buildIn(tree, names, { publish = false } = {}) {
  const run = (cmd, ...args) =>
    execFileSync(cmd, args, { cwd: tree, stdio: 'inherit' })
  run('pnpm', 'install', '--frozen-lockfile')
  run(
    'node',
    'scripts/build.mjs',
    '--only',
    names.join(','),
    ...(publish ? ['--publish'] : []),
  )
  return JSON.parse(await readFile(join(tree, 'dist', 'entries.json'), 'utf8'))
}

// Copies a built plugin's folder, zip and pages from one site folder to
// another.
export async function copyBuilt(from, to, e) {
  await cp(join(from, e.id), join(to, e.id), { recursive: true })
  await cp(join(from, `${e.id}.zip`), join(to, `${e.id}.zip`))
  if (existsSync(join(from, e.folder)))
    await cp(join(from, e.folder), join(to, e.folder), { recursive: true })
}

// Adds each listed plugin, built from its repo's main without incubating
// plugins, to the develop channel in dist/ that `build.mjs --publish` made.
async function develop() {
  const dist = join(root, 'dist')
  const site = join(dist, 'site')
  const entries = JSON.parse(await readFile(join(dist, 'entries.json'), 'utf8'))
  for (const { repo, folder } of await listExternal()) {
    const tree = await clone(repo)
    try {
      for (const e of await buildIn(tree, [folder], { publish: true })) {
        await copyBuilt(join(tree, 'dist', 'site'), site, e)
        entries.push({ ...e, repo })
        console.log(`${folder}: ${e.version} from ${repo} main`)
      }
    } finally {
      await rm(tree, { recursive: true, force: true })
    }
  }
  await writeSource(site, entries)
  await writeFile(join(dist, 'entries.json'), JSON.stringify(entries, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv[2] !== 'develop')
    throw new Error('Usage: node scripts/external.mjs develop')
  await develop()
}
