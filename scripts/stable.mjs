// Builds the stable channel into <out>: each plugin from its own latest
// release tag (<folder>-vX.Y.Z) reachable from HEAD, so releasing one plugin
// never ships another plugin's unreleased work from main. A plugin with no
// tag yet stays out of the stable channel. Tags passed with --tags replace a
// plugin's latest tag, to roll it back. Each entry's path is the zip attached
// to its tag's GitHub Release, which must hash to the same sha256 as the build;
// the zips are also copied next to the index, for indexes read before a switch.
// A plugin from another CandyBoudoir repo (plugins.external.json, see
// external.mjs) is built the same way from a clone of that repo at its own
// latest tag, and its path is the zip on that repo's release.
// Usage: node scripts/stable.mjs <out> [--tags "juicy-v0.3.2 remix-v0.1.0"]
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  buildIn,
  clone,
  copyBuilt,
  latestTag,
  listExternal,
} from './external.mjs'
import { assetDigest, assetURL } from './release-assets.mjs'
import { indexYml, listPlugins, root, writeSource } from './site.mjs'

const out = resolve(process.argv[2])
const pins = process.argv.includes('--tags')
  ? process.argv[process.argv.indexOf('--tags') + 1]
      .split(/\s+/)
      .filter(Boolean)
  : []
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

// Plugin folder -> tag to build it from, for this repo's plugins and for each
// listed one in another repo, cloned once.
const tags = new Map()
const external = new Map()
const trees = []
for (const { name } of await listPlugins())
  tags.set(name, latestTag(root, name, pins))
for (const { repo, folder } of await listExternal()) {
  const tree = await clone(repo)
  trees.push(tree)
  external.set(folder, { repo, tree })
  tags.set(folder, latestTag(tree, folder, pins))
}
for (const [name, tag] of tags)
  if (!tag) {
    console.log(`${name}: no release tag yet, left out of stable`)
    tags.delete(name)
  }
for (const t of pins)
  if (![...tags.values()].includes(t)) throw new Error(`No plugin for tag ${t}`)
// A run that starts before prod's release job has tagged anything must fail
// rather than publish a stable channel with no plugins in it.
if (!tags.size) throw new Error('No plugin has a release tag yet')

// Builds plugins in a checkout at their tag and adds them to the channel,
// each pointing at its zip on that tag's release in repo.
async function add(tree, names, tag, repo) {
  for (const e of await buildIn(tree, names)) {
    await copyBuilt(join(tree, 'dist', 'site'), out, e)
    e.path = assetURL(tag, `${e.id}.zip`, repo)
    const digest = await assetDigest(e.path)
    if (digest !== e.sha256)
      throw new Error(
        `${tag}: the release's ${e.id}.zip hashes to ${digest}, the build to ${e.sha256}`,
      )
    if (e.legacy)
      await writeFile(join(out, e.folder, 'index.yml'), indexYml([e]))
    entries.push(repo ? { ...e, repo } : e)
    console.log(
      `${e.folder}: ${e.version} from ${repo ? `${repo} ` : ''}${tag}`,
    )
  }
}

await rm(out, { recursive: true, force: true })
const entries = []
try {
  const own = [...tags].filter(([n]) => !external.has(n))
  for (const tag of new Set(own.map(([, t]) => t))) {
    const names = own.filter(([, t]) => t === tag).map(([n]) => n)
    const tree = await mkdtemp(join(tmpdir(), `${tag}-`))
    git('worktree', 'add', '--detach', tree, tag)
    try {
      await add(tree, names, tag)
    } finally {
      git('worktree', 'remove', '--force', tree)
    }
  }
  for (const [folder, { repo, tree }] of external) {
    if (!tags.has(folder)) continue
    execFileSync('git', ['checkout', '--quiet', '--detach', tags.get(folder)], {
      cwd: tree,
    })
    await add(tree, [folder], tags.get(folder), repo)
  }
} finally {
  for (const tree of trees) await rm(tree, { recursive: true, force: true })
}
await writeSource(out, entries)
