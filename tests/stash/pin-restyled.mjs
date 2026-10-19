// Moves the pins of the plugins the themes restyle (RESTYLED in
// companions.mjs) to each author's latest release:
// `node tests/stash/pin-restyled.mjs [<key>,<key>]` (every one by default).
//
// For each, it reads the release from the plugin's source index, downloads
// the zip that index serves and walks the commits that changed the plugin's
// folder in the author's GitLab repository, newest first, to the one whose
// folder holds the zip's files (by git blob id). It pins that commit and the
// sha256 of each file, fetched from the raw URLs the tests use, and moves the
// version each restyling theme names in its README and docs/design.md, and
// in the "Tested beside" sentence of a theme version with no release tag
// yet. Released CHANGELOG sections keep what they shipped beside, and no
// theme's version changes. It stops before writing anything when no commit
// holds the zip's files or the folder has a subfolder. The specs and
// baselines are left to whoever runs it.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESTYLED, restyledBy } from './companions.mjs'

const root = join(import.meta.dirname, '..', '..')

const hash = (algorithm, data) =>
  createHash(algorithm).update(data).digest('hex')
// The id git gives a file's content
const blobId = (data) =>
  hash(
    'sha1',
    Buffer.concat([Buffer.from(`blob ${data.length}\0`), Buffer.from(data)]),
  )
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res
}

// A field of one entry in a plugin source index, unquoted
const field = (entry, key) =>
  entry.match(
    new RegExp(`^\\s*${key}:\\s*['"]?([^'"\\n]+?)['"]?\\s*$`, 'm'),
  )?.[1]

// The release the plugin's source index serves: its version and zip URL
async function release(r) {
  const index = await (await get(r.latest.index)).text()
  const entry = index
    .split(/^- /m)
    .find((e) => field(e, 'id') === r.id && /^id:/.test(e))
  if (!entry) throw new Error(`${r.latest.index} lists no plugin ${r.id}`)
  return {
    version: field(entry, 'version'),
    zip: new URL(field(entry, 'path'), r.latest.index).href,
    sha256: field(entry, 'sha256'),
  }
}

// The files in the zip's plugin folder, by name, read with unzip
async function zipFiles(r, { zip, sha256 }) {
  const data = Buffer.from(await (await get(zip)).arrayBuffer())
  if (sha256 && hash('sha256', data) !== sha256)
    throw new Error(`${zip} does not match the sha256 its index gives`)
  const dir = await mkdtemp(join(tmpdir(), 'pin-restyled-'))
  try {
    const file = join(dir, 'plugin.zip')
    await writeFile(file, data)
    const files = {}
    for (const entry of execFileSync('unzip', ['-Z1', file], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((e) => e && !e.endsWith('/'))) {
      const name = entry.replace(new RegExp(`^${literal(r.id)}/`), '')
      if (name.includes('/'))
        throw new Error(
          `${zip} holds ${entry}: a subfolder, which RESTYLED cannot pin`,
        )
      files[name] = execFileSync('unzip', ['-p', file, entry], {
        maxBuffer: 64 * 1024 * 1024,
      })
    }
    return files
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// The author's repository and the plugin's folder in it, from the raw URL
// the pin's files come from
function source(r) {
  const m = r.base.match(
    /^https:\/\/gitlab\.com\/(.+?)\/-\/raw\/[0-9a-f]{40}\/(.+)$/,
  )
  if (!m) throw new Error(`RESTYLED.${r.key}.base is not a GitLab raw URL`)
  return {
    api: `https://gitlab.com/api/v4/projects/${encodeURIComponent(m[1])}/repository`,
    folder: m[2],
  }
}

// The newest commit whose plugin folder holds exactly these files
async function releaseCommit(r, files) {
  const { api, folder } = source(r)
  const want = Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, blobId(data)]),
  )
  const commits = await (
    await get(`${api}/commits?path=${encodeURIComponent(folder)}&per_page=20`)
  ).json()
  for (const { id } of commits) {
    const tree = await (
      await get(
        `${api}/tree?path=${encodeURIComponent(folder)}&ref=${id}&per_page=100`,
      )
    ).json()
    const have = Object.fromEntries(
      tree.filter((t) => t.type === 'blob').map((t) => [t.name, t.id]),
    )
    if (
      !tree.some((t) => t.type === 'tree') &&
      JSON.stringify(Object.entries(have).sort()) ===
        JSON.stringify(Object.entries(want).sort())
    )
      return id
  }
  throw new Error(
    `None of the last ${commits.length} commits to ${folder} holds the files of the zip its index serves`,
  )
}

// companions.mjs with RESTYLED[key] pinned to version, commit and files
// (name -> sha256): the entry, the comment above it and the commit constant
// it names
export function rewritePin(text, key, { version, commit, files }) {
  const start = text.search(new RegExp(`^  ${key}: \\{$`, 'm'))
  if (start < 0) throw new Error(`companions.mjs has no RESTYLED.${key}`)
  const end = text.indexOf('\n  },\n', start)
  const old = text.slice(start, end).match(/^ {4}version: '([^']+)',$/m)[1]
  const lines = text.slice(0, start).split('\n')
  let top = lines.length - 1
  while (top > 0 && lines[top - 1].startsWith('  //')) top--
  const comment = lines.slice(top).join('\n')
  const entry = text
    .slice(start, end)
    .replace(/^( {4}version: )'[^']+',$/m, `$1'${version}',`)
    .replace(
      /^ {4}files: \{\n[\s\S]*?\n {4}\},$/m,
      [
        '    files: {',
        ...Object.keys(files)
          .sort()
          .map((name) => `      '${name}':\n        '${files[name]}',`),
        '    },',
      ].join('\n'),
    )
  let head =
    lines.slice(0, top).join('\n') + '\n' + comment.replaceAll(old, version)
  const constant = entry.match(/^ {4}commit: ([A-Z_]+),$/m)?.[1]
  const pinned = constant
    ? entry
    : entry.replace(/^( {4}commit: )'[0-9a-f]{40}',$/m, `$1'${commit}',`)
  if (constant)
    head = head.replace(
      new RegExp(`^(const ${constant} = )'[0-9a-f]{40}'$`, 'm'),
      `$1'${commit}'`,
    )
  return head + pinned + text.slice(end)
}

// A theme's text with every "<name> <old>" read as "<name> <version>"
export const moveVersion = (text, name, old, version) =>
  text.replaceAll(`${name} ${old}`, `${name} ${version}`)

// A CHANGELOG with the Tested beside sentence of version's section moved
export function moveTestedBeside(changelog, themeVersion, name, old, version) {
  return changelog
    .split(/^(?=## )/m)
    .map((section) =>
      section.startsWith(`## ${themeVersion}\n`) ||
      section.startsWith(`## ${themeVersion} `)
        ? section
            .split('\n')
            .map((line) =>
              line.includes('Tested beside')
                ? moveVersion(line, name, old, version)
                : line,
            )
            .join('\n')
        : section,
    )
    .join('')
}

// The themes that restyle the plugin, with their versions and whether each
// is released
async function restylingThemes(key) {
  const themes = []
  for (const folder of (await readdir(join(root, 'plugins'))).sort()) {
    if (!(await restyledBy(folder)).some((r) => r.key === key)) continue
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
    themes.push({ folder, version, released: Boolean(released) })
  }
  return themes
}

async function edit(file, change) {
  const before = await readFile(file, 'utf8').catch(() => null)
  if (before === null) return false
  const after = change(before)
  if (after === before) return false
  await writeFile(file, after)
  return true
}

async function pin(key) {
  const r = { key, ...RESTYLED[key] }
  const latest = await release(r)
  if (latest.version === r.version) {
    console.log(`${r.name} is pinned to its latest release, ${r.version}`)
    return []
  }
  const files = await zipFiles(r, latest)
  const commit = await releaseCommit(r, files)
  const base = r.base.replace(r.commit, commit)
  const sha256s = {}
  for (const [name, data] of Object.entries(files)) {
    const body = Buffer.from(await (await get(`${base}/${name}`)).arrayBuffer())
    if (!body.equals(data))
      throw new Error(`${base}/${name} differs from the zip's ${name}`)
    sha256s[name] = hash('sha256', body)
  }

  const changed = []
  const companions = join(root, 'tests', 'stash', 'companions.mjs')
  await edit(companions, (text) =>
    rewritePin(text, key, { version: latest.version, commit, files: sha256s }),
  )
  changed.push(companions)
  const themes = await restylingThemes(key)
  for (const { folder, version, released } of themes) {
    const dir = join(root, 'plugins', folder)
    for (const doc of ['README.md', join('docs', 'design.md')])
      if (
        await edit(join(dir, doc), (text) =>
          moveVersion(text, r.name, r.version, latest.version),
        )
      )
        changed.push(join(dir, doc))
    if (
      !released &&
      (await edit(join(dir, 'CHANGELOG.md'), (text) =>
        moveTestedBeside(text, version, r.name, r.version, latest.version),
      ))
    )
      changed.push(join(dir, 'CHANGELOG.md'))
  }
  console.log(
    `${r.name}: ${r.version} -> ${latest.version}, commit ${commit.slice(0, 12)}, ${Object.keys(files).length} files (${Object.keys(files).sort().join(', ')})`,
  )
  console.log(`Restyled by ${themes.map((t) => t.folder).join(', ')}`)
  return changed
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const keys = process.argv[2]
    ? process.argv[2].split(',').map((k) => k.trim().toLowerCase())
    : Object.keys(RESTYLED)
  for (const key of keys)
    if (!RESTYLED[key]) throw new Error(`Unknown restyled plugin ${key}`)
  const changed = []
  for (const key of keys) changed.push(...(await pin(key)))
  if (changed.length) {
    execFileSync('pnpm', ['exec', 'prettier', '--write', ...new Set(changed)], {
      cwd: root,
      stdio: 'inherit',
    })
    console.log(
      `\nNow run the contract specs of the themes named above on a test Stash, fix any class they report newly missing, and refresh their baselines.`,
    )
  }
}
