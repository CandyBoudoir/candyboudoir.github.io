// Builds the stable channel into <out>: each plugin from its own latest
// release tag (<folder>-vX.Y.Z) reachable from HEAD, so releasing one plugin
// never ships another plugin's unreleased work from main. A plugin with no
// tag yet stays out of the stable channel. Tags passed with --tags replace a
// plugin's latest tag, to roll it back.
// Usage: node scripts/stable.mjs <out> [--tags "juicy-v0.3.2 remix-v0.1.0"]
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { listPlugins, root, writeSource } from './site.mjs'

const out = resolve(process.argv[2])
const pins = process.argv.includes('--tags')
  ? process.argv[process.argv.indexOf('--tags') + 1]
      .split(/\s+/)
      .filter(Boolean)
  : []
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

// Plugin folder -> tag to build it from.
const tags = new Map()
for (const { name } of await listPlugins()) {
  const pinned = pins.find((t) => t.startsWith(`${name}-v`))
  const latest = git(
    'tag',
    '--merged',
    'HEAD',
    '--list',
    `${name}-v*`,
    '--sort=-version:refname',
  ).split('\n')[0]
  const tag = pinned ?? latest
  if (tag) tags.set(name, tag)
  else console.log(`${name}: no release tag yet, left out of stable`)
}
for (const t of pins)
  if (![...tags.values()].includes(t)) throw new Error(`No plugin for tag ${t}`)

await rm(out, { recursive: true, force: true })
const entries = []
for (const tag of new Set(tags.values())) {
  const names = [...tags].filter(([, t]) => t === tag).map(([n]) => n)
  const tree = await mkdtemp(join(tmpdir(), `${tag}-`))
  git('worktree', 'add', '--detach', tree, tag)
  try {
    const run = (cmd, ...args) =>
      execFileSync(cmd, args, { cwd: tree, stdio: 'inherit' })
    run('pnpm', 'install', '--frozen-lockfile')
    run('node', 'scripts/build.mjs', '--only', names.join(','))
    const built = JSON.parse(
      await readFile(join(tree, 'dist', 'entries.json'), 'utf8'),
    )
    for (const e of built) {
      const site = join(tree, 'dist', 'site')
      await cp(join(site, e.id), join(out, e.id), { recursive: true })
      await cp(join(site, `${e.id}.zip`), join(out, `${e.id}.zip`))
      if (existsSync(join(site, e.folder)))
        await cp(join(site, e.folder), join(out, e.folder), { recursive: true })
      entries.push(e)
      console.log(`${e.folder}: ${e.version} from ${tag}`)
    }
  } finally {
    git('worktree', 'remove', '--force', tree)
  }
}
await writeSource(out, entries)
