// Publishes a GitHub Release for the version in src/Theme-Juicy.yml if it has
// no tag yet. Fails if CHANGELOG.md has no section for that version, so a
// version bump always ships with notes. Run after `pnpm build`.
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()
const version = (await readFile('src/Theme-Juicy.yml', 'utf8')).match(
  /^version: (.+)$/m,
)[1]
const tag = `v${version}`

const tags = execFileSync('git', ['tag', '--list', tag], {
  encoding: 'utf8',
}).trim()
if (tags) {
  console.log(`${tag} already exists; nothing to release`)
  process.exit(0)
}

const changelog = await readFile('CHANGELOG.md', 'utf8')
const section = changelog
  .split(/^## /m)
  .find((s) => s.startsWith(`${version}\n`) || s.startsWith(`${version} `))
if (!section) throw new Error(`CHANGELOG.md has no "## ${version}" section`)
const notes = section.slice(section.indexOf('\n') + 1).trim()

const { stable } = JSON.parse(
  await readFile('tests/stash-versions.json', 'utf8'),
)
const tested = stable.map((s) => s.version).join(', ')
await writeFile(
  'release-notes.md',
  `${notes}\n\nTested on Stash ${tested}. The attached zip is the same file the plugin source serves.\n`,
)

console.log(
  gh(
    'release',
    'create',
    tag,
    '--target',
    process.env.GITHUB_SHA,
    '--title',
    `Juicy ${version}`,
    '--notes-file',
    'release-notes.md',
    'dist/site/Theme-Juicy.zip',
  ),
)
