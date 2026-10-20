// Moves the pins of the plugins that plugins here extend (EXTENDED in
// companions.mjs) to the newest change to each one's plugin folder in its
// author's GitHub repository:
// `node tests/stash/pin-extended.mjs [<key>,<key>]` (every one by default).
//
// For each, it fetches that commit alone, as the tests do, reads the version
// from the plugin's manifest there, and checks that the zip the author's
// source serves (latest.index) holds the folder's files as committed. It
// pins the commit, its version and its date, and moves the version each
// plugin that extends it names in its README, and in the "Tested beside"
// sentence of a version with no release tag yet. Released CHANGELOG sections
// keep what they shipped beside, and no plugin's version changes. It stops
// before writing anything when the source still serves an older release or
// a zip that differs from the folder. The specs are left to whoever runs it.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkoutExtended } from './companion-zips.mjs'
import { EXTENDED } from './companions.mjs'
import { moveTestedBeside, moveVersion } from './pin-restyled.mjs'

const root = join(import.meta.dirname, '..', '..')
const headers = process.env.GITHUB_TOKEN
  ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {}

async function get(url, init) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res
}

// A field of one entry in a plugin source index, unquoted
const field = (entry, key) =>
  entry.match(
    new RegExp(`^\\s*${key}:\\s*['"]?([^'"\\n]+?)['"]?\\s*$`, 'm'),
  )?.[1]

// Every file in a folder, by its path in it
async function filesIn(dir) {
  const files = {}
  for (const e of await readdir(dir, { recursive: true, withFileTypes: true }))
    if (e.isFile()) {
      const path = join(e.parentPath, e.name)
      files[relative(dir, path)] = await readFile(path)
    }
  return files
}

// The names of the files that differ between two folders' files
const differing = (a, b) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((name) => !a[name] || !b[name] || !a[name].equals(b[name]))
    .sort()

// companions.mjs with EXTENDED[key] pinned to version, commit and date: the
// entry and the version the comment above it names
export function rewriteExtended(text, key, { version, commit, date }) {
  const from = text.indexOf('export const EXTENDED = {')
  const at = text.slice(from).search(new RegExp(`^  ${key}: \\{$`, 'm'))
  if (from < 0 || at < 0)
    throw new Error(`companions.mjs has no EXTENDED.${key}`)
  const start = from + at
  const end = text.indexOf('\n  },\n', start)
  const entry = text.slice(start, end)
  const old = entry.match(/^ {4}version: '([^']+)',$/m)[1]
  const name = entry.match(/^ {4}name: '([^']+)',$/m)[1]
  const lines = text.slice(0, start).split('\n')
  let top = lines.length - 1
  while (top > 0 && lines[top - 1].startsWith('  //')) top--
  const comment = lines.slice(top).join('\n')
  return (
    lines.slice(0, top).join('\n') +
    '\n' +
    comment.replaceAll(`${name} ${old}`, `${name} ${version}`) +
    entry
      .replace(/^( {4}version: )'[^']+',$/m, `$1'${version}',`)
      .replace(/^( {4}commit: )'[0-9a-f]{40}',$/m, `$1'${commit}',`)
      .replace(/^( {4}date: )'[^']+',$/m, `$1'${date}',`) +
    text.slice(end)
  )
}

async function edit(file, change) {
  const before = await readFile(file, 'utf8').catch(() => null)
  if (before === null) return false
  const after = change(before)
  if (after === before) return false
  await writeFile(file, after)
  return true
}

// The plugins that extend it, with their versions and whether each is
// released
async function extendingPlugins(e) {
  const plugins = []
  for (const folder of e.extendedBy) {
    const src = join(root, 'plugins', folder, 'src')
    const yml = (await readdir(src)).find((f) => f.endsWith('.yml'))
    const version = (await readFile(join(src, yml), 'utf8')).match(
      /^version: (.+)$/m,
    )[1]
    const released = execFileSync(
      'git',
      ['tag', '--list', `${folder}-v${version}`],
      { cwd: root, encoding: 'utf8' },
    ).trim()
    plugins.push({ folder, version, released: Boolean(released) })
  }
  return plugins
}

async function pin(key) {
  const e = { key, ...EXTENDED[key] }
  const [newest] = await (
    await get(
      `https://api.github.com/repos/${e.repo}/commits?path=${encodeURIComponent(e.folder)}&per_page=1`,
      { headers },
    )
  ).json()
  if (newest.sha === e.commit) {
    console.log(`${e.name} is pinned to its newest change, ${e.version}`)
    return []
  }

  const dir = await mkdtemp(join(tmpdir(), 'pin-extended-'))
  let next
  try {
    const checkout = await checkoutExtended({ ...e, commit: newest.sha }, dir)
    // The source's zip of the same release holds the same files
    const index = await (await get(e.latest.index)).text()
    const entry = index
      .split(/^- /m)
      .find((s) => field(s, 'id') === e.id && /^id:/.test(s))
    if (!entry) throw new Error(`${e.latest.index} lists no plugin ${e.id}`)
    if (field(entry, 'version') !== checkout.version)
      throw new Error(
        `${e.latest.index} still serves ${e.name} ${field(entry, 'version')}, not ${checkout.version} from ${newest.sha.slice(0, 12)}: run this again once it does`,
      )
    const zip = Buffer.from(
      await (
        await get(new URL(field(entry, 'path'), e.latest.index))
      ).arrayBuffer(),
    )
    if (
      createHash('sha256').update(zip).digest('hex') !== field(entry, 'sha256')
    )
      throw new Error(`${e.id}'s zip does not match the sha256 its index gives`)
    const unzipped = join(dir, 'served')
    await writeFile(join(dir, 'served.zip'), zip)
    execFileSync('unzip', ['-q', join(dir, 'served.zip'), '-d', unzipped])
    const differ = differing(
      await filesIn(checkout.folder),
      await filesIn(unzipped),
    )
    if (differ.length)
      throw new Error(
        `The zip ${e.latest.index} serves differs from ${e.folder} at ${newest.sha.slice(0, 12)} in ${differ.join(', ')}`,
      )
    next = {
      version: checkout.version,
      commit: newest.sha,
      date: checkout.date,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  const changed = []
  const companions = join(root, 'tests', 'stash', 'companions.mjs')
  await edit(companions, (text) => rewriteExtended(text, key, next))
  changed.push(companions)
  const plugins = await extendingPlugins(e)
  for (const { folder, version, released } of plugins) {
    const pluginDir = join(root, 'plugins', folder)
    if (
      await edit(join(pluginDir, 'README.md'), (text) =>
        moveVersion(text, e.name, e.version, next.version),
      )
    )
      changed.push(join(pluginDir, 'README.md'))
    if (
      !released &&
      (await edit(join(pluginDir, 'CHANGELOG.md'), (text) =>
        moveTestedBeside(text, version, e.name, e.version, next.version),
      ))
    )
      changed.push(join(pluginDir, 'CHANGELOG.md'))
  }
  console.log(
    `${e.name}: ${e.version} -> ${next.version}, commit ${next.commit.slice(0, 12)} of ${next.date}`,
  )
  console.log(`Extended by ${plugins.map((p) => p.folder).join(', ')}`)
  return changed
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const keys = process.argv[2]
    ? process.argv[2].split(',').map((k) => k.trim().toLowerCase())
    : Object.keys(EXTENDED)
  for (const key of keys)
    if (!EXTENDED[key]) throw new Error(`Unknown extended plugin ${key}`)
  const changed = []
  for (const key of keys) changed.push(...(await pin(key)))
  if (changed.length) {
    execFileSync('pnpm', ['exec', 'prettier', '--write', ...new Set(changed)], {
      cwd: root,
      stdio: 'inherit',
    })
    console.log(
      `\nNow run the contract specs of the plugins named above on a test Stash.`,
    )
  }
}
