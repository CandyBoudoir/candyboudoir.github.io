// Keeps Cherry Pick tested beside the latest release of each companion plugin
// (companions.mjs), and saying so.
//
// Always: the Tested with table in Cherry Pick's README names the Stash
// versions in stash-versions.json and the pinned companion versions.
// While Cherry Pick's version has no cherrypick-vX.Y.Z tag yet (a release on
// its way): that version's CHANGELOG section carries testedBeside(), and
// every pin is its author's latest release.
// With --issues (the nightly Compatibility run): instead of failing, keeps one
// open "Test Cherry Pick beside <plugin> <version>" issue per companion with a
// newer release, and closes it once the pin catches up. Needs GH_TOKEN.
//
// Reads the latest releases over the network, for a release and --issues
// only; GITHUB_TOKEN raises GitHub's rate limit.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { COMPANIONS, TESTED_PLUGIN, testedBeside } from './companions.mjs'

const root = join(import.meta.dirname, '..', '..')
const dir = join(root, 'plugins', TESTED_PLUGIN)
const issues = process.argv.includes('--issues')
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
  entry.match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]+?)"?\\s*$`, 'm'))?.[1]

// The author's latest release of a companion, and whether the pin is it. A
// source index answers with its entry's sha256 where it has one (Ascension's
// version field is not its release number) and its version otherwise.
async function latest({ package: pkg, latest: where }) {
  if (where.release) {
    const res = await get(
      `https://api.github.com/repos/${where.release}/releases/latest`,
      { headers },
    )
    const version = (await res.json()).tag_name.replace(/^v/, '')
    return { version, current: version === pkg.version }
  }
  const index = await (await get(where.index)).text()
  const entry = index
    .split(/^- /m)
    .find((e) => field(e, 'id') === pkg.id && /^id:/.test(e))
  if (!entry) throw new Error(`${where.index} lists no plugin ${pkg.id}`)
  const version = field(entry, 'version')
  const sha256 = field(entry, 'sha256')
  const current = sha256 ? sha256 === pkg.sha256 : version === pkg.version
  return { version: current ? pkg.version : version, current }
}

// Every companion with its latest release, read only when needed, so an
// author's site being down fails a release or the nightly run, not every
// change
async function withLatest() {
  const all = await Promise.all(
    Object.entries(COMPANIONS).map(async ([key, c]) => ({
      key,
      ...c,
      ...(await latest(c)),
    })),
  )
  for (const c of all)
    console.log(
      `${c.package.name}: tested ${c.package.version}, latest ${c.version}${c.current ? '' : ' (newer)'}`,
    )
  return all
}

if (issues) {
  const companions = await withLatest()
  const LABEL = 'companion-release'
  const gh = (...args) =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
    })
  gh(
    'label',
    'create',
    LABEL,
    '--color',
    '1d76db',
    '--description',
    'A plugin Cherry Pick is tested beside has a newer release',
    '--force',
  )
  const open = JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'open',
      '--label',
      LABEL,
      '--json',
      'number,title',
      '--limit',
      '50',
    ),
  )
  for (const c of companions) {
    const prefix = `Test Cherry Pick beside ${c.package.name} `
    const title = `${prefix}${c.version}`
    for (const i of open.filter(
      (i) => i.title.startsWith(prefix) && (c.current || i.title !== title),
    ))
      gh(
        'issue',
        'close',
        String(i.number),
        '--comment',
        c.current
          ? `The ${c.package.name} pin is its latest release, ${c.package.version}.`
          : `Superseded: ${c.package.name} ${c.version} is out.`,
      )
    if (!c.current && !open.some((i) => i.title === title))
      gh(
        'issue',
        'create',
        '--label',
        LABEL,
        '--title',
        title,
        '--body',
        [
          `${c.package.name} ${c.version} is out, and Cherry Pick's companion leg still tests ${c.package.version}.`,
          '',
          `Pin the new release in \`tests/stash/companions.mjs\`, read its changes against \`plugins/cherrypick/docs/stash-seams.md\`, run the leg (\`COMPANIONS=${c.key}\`), and update the Tested with table in \`plugins/cherrypick/README.md\`. Cherry Pick cannot release until the pin catches up.`,
        ].join('\n'),
      )
  }
  process.exit(0)
}

const problems = []

// The README's Tested with table
const readme = await readFile(join(dir, 'README.md'), 'utf8')
const { stable } = JSON.parse(
  await readFile(join(root, 'tests', 'stash-versions.json'), 'utf8'),
)
const expected = [
  ['Stash', stable.map((s) => s.version).join(', ')],
  ...Object.values(COMPANIONS).map((c) => [c.package.name, c.package.version]),
]
const table = (
  readme.split(/^## /m).find((s) => s.startsWith('Tested with\n')) ?? ''
)
  .split('\n')
  .filter((l) => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
  .slice(1)
  .map((l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim()),
  )
if (JSON.stringify(table) !== JSON.stringify(expected))
  problems.push(
    `plugins/${TESTED_PLUGIN}/README.md's "## Tested with" table should list, in order:\n${expected.map(([p, v]) => `  | ${p} | ${v} |`).join('\n')}`,
  )

// A release on its way: the CHANGELOG says what it was tested beside, and
// that is the latest of each
const manifest = await readFile(join(dir, 'src', 'CherryPick.yml'), 'utf8')
const version = manifest.match(/^version: (.+)$/m)[1]
const tag = `${TESTED_PLUGIN}-v${version}`
const tagged = execFileSync('git', ['tag', '--list', tag], {
  cwd: root,
  encoding: 'utf8',
}).trim()
if (!tagged) {
  const changelog = await readFile(join(dir, 'CHANGELOG.md'), 'utf8')
  const section = changelog
    .split(/^## /m)
    .find((s) => s.startsWith(`${version}\n`) || s.startsWith(`${version} `))
  if (!section?.includes(testedBeside()))
    problems.push(
      `plugins/${TESTED_PLUGIN}/CHANGELOG.md's "## ${version}" section should say:\n  ${testedBeside()}`,
    )
  for (const c of (await withLatest()).filter((c) => !c.current))
    problems.push(
      `${tag} would ship tested beside ${c.package.name} ${c.package.version}, but ${c.version} is out: pin it in tests/stash/companions.mjs and run its leg`,
    )
}

if (problems.length) {
  console.error(`\n${problems.join('\n\n')}`)
  process.exit(1)
}
console.log(
  tagged
    ? `\n${tag} is released; the README's Tested with table matches the pins`
    : `\n${tag} is tested beside the latest release of every companion and says so`,
)
