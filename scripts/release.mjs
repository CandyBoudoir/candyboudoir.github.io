// Tags and publishes a GitHub Release for each plugin whose version on this
// commit has no <folder>-vX.Y.Z tag yet. Fails if the plugin's CHANGELOG.md
// has no section for that version, so a version bump always ships with notes,
// or when Cherry Pick's section does not name the companion plugin versions
// its tests ran beside (tests/stash/tested-with.mjs checks the same on pull
// requests).
// Run after `pnpm build`, on prod.
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { listPlugins, root } from './site.mjs'
import { TESTED_PLUGIN, testedBeside } from '../tests/stash/companions.mjs'

const run = (cmd, ...args) =>
  execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim()
const site = join(root, 'dist', 'site')

const { stable } = JSON.parse(
  await readFile(join(root, 'tests', 'stash-versions.json'), 'utf8'),
)
const tested = stable.map((s) => s.version).join(', ')

for (const { name, dir, mod } of await listPlugins()) {
  const manifest = await readFile(join(site, mod.id, `${mod.id}.yml`), 'utf8')
  const version = manifest.match(/^version: (.+)$/m)[1]
  const tag = `${name}-v${version}`
  if (run('git', 'tag', '--list', tag)) {
    console.log(`${tag} already exists; nothing to release`)
    continue
  }

  const changelog = await readFile(join(dir, 'CHANGELOG.md'), 'utf8')
  const section = changelog
    .split(/^## /m)
    .find((s) => s.startsWith(`${version}\n`) || s.startsWith(`${version} `))
  if (!section)
    throw new Error(
      `plugins/${name}/CHANGELOG.md has no "## ${version}" section`,
    )
  const notes = section.slice(section.indexOf('\n') + 1).trim()
  if (name === TESTED_PLUGIN && !notes.includes(testedBeside()))
    throw new Error(
      `plugins/${name}/CHANGELOG.md's "## ${version}" section does not say: ${testedBeside()}`,
    )
  const file = join(root, 'dist', `${name}-release-notes.md`)
  await writeFile(
    file,
    `${notes}\n\nTested on Stash ${tested}. The attached zip is the same file the plugin source serves.\n`,
  )

  console.log(
    run(
      'gh',
      'release',
      'create',
      tag,
      '--target',
      process.env.GITHUB_SHA,
      '--title',
      `${mod.title} ${version}`,
      '--notes-file',
      file,
      join(site, `${mod.id}.zip`),
    ),
  )
}
