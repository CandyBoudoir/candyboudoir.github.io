// Keeps Cherry Pick tested beside the latest release of each companion plugin
// (companions.mjs), and each theme beside the latest release of each plugin
// it restyles (RESTYLED), and saying so.
//
// Always: the Tested with table in Cherry Pick's README names the Stash
// versions in stash-versions.json and the pinned companion versions, and a
// restyling theme's README names the pinned version of each plugin it
// restyles.
// While a plugin's version has no <folder>-vX.Y.Z tag yet (a release on its
// way): that version's CHANGELOG section carries testedBeside() (Cherry Pick)
// or restyledBeside() (a restyling theme), and every pin it names is its
// author's latest release.
// With --issues (the nightly Compatibility run): instead of failing, keeps one
// open "Test Cherry Pick beside <plugin> <version>" issue per companion with a
// newer release, and one "Restyle <plugin> <version>" issue per plugin the
// themes restyle (RESTYLED), and closes each once its pin catches up. Needs
// GH_TOKEN.
//
// Reads the latest releases over the network, for a release and --issues
// only; GITHUB_TOKEN raises GitHub's rate limit.
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  COMPANIONS,
  RESTYLED,
  TESTED_PLUGIN,
  restyled,
  restyledBeside,
  restyledBy,
  testedBeside,
} from './companions.mjs'

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

// The latest release of a plugin the themes restyle, from its source index,
// and whether the pin is it
async function latestRestyled(r) {
  const index = await (await get(r.latest.index)).text()
  const entry = index
    .split(/^- /m)
    .find((e) => field(e, 'id') === r.id && /^id:/.test(e))
  if (!entry) throw new Error(`${r.latest.index} lists no plugin ${r.id}`)
  const version = field(entry, 'version')
  return { version, current: version === r.version }
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
    'A plugin the tests pin to one release has a newer one',
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
  for (const [key, r] of Object.entries(RESTYLED)) {
    const { version, current } = await latestRestyled(r)
    // The themes that restyle it keep its unmatched-class baseline
    const themes = []
    for (const folder of await readdir(join(root, 'plugins')))
      if (
        await readFile(
          join(
            root,
            'plugins',
            folder,
            'tests',
            `${key}-unmatched-baseline.txt`,
          ),
        ).then(
          () => true,
          () => false,
        )
      )
        themes.push(folder)
    console.log(
      `${r.name}: restyled ${r.version}, latest ${version}${current ? '' : ' (newer)'}`,
    )
    const prefix = `Restyle ${r.name} `
    const title = `${prefix}${version}`
    for (const i of open.filter(
      (i) => i.title.startsWith(prefix) && (current || i.title !== title),
    ))
      gh(
        'issue',
        'close',
        String(i.number),
        '--comment',
        current
          ? `The ${r.name} pin is its latest release, ${r.version}.`
          : `Superseded: ${r.name} ${version} is out.`,
      )
    if (!current && !open.some((i) => i.title === title))
      gh(
        'issue',
        'create',
        '--label',
        LABEL,
        '--title',
        title,
        '--body',
        [
          `${r.name} ${version} is out, and the themes that restyle it (${themes.join(', ')}) are still tested against ${r.version}.`,
          '',
          `Pin its files at the release commit in \`tests/stash/companions.mjs\` (RESTYLED.${key}), run those themes' contract and visual specs, fix any class the release renamed (each theme's check against \`tests/${key}-unmatched-baseline.txt\` names them), refresh their baselines, and update the version their README names.`,
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

// The themes that restyle another author's plugin: the README names the
// pinned version of each, and a release on its way says what it was tested
// beside, which must be the latest release of each
const restyling = []
let latestRestyles
for (const folder of (await readdir(join(root, 'plugins'))).sort()) {
  const list = await restyledBy(folder)
  if (!list.length) continue
  const themeDir = join(root, 'plugins', folder)
  const themeReadme = await readFile(join(themeDir, 'README.md'), 'utf8')
  for (const r of list)
    if (!themeReadme.includes(`${r.name} ${r.version}`))
      problems.push(
        `plugins/${folder}/README.md should name ${r.name} ${r.version}, the release its specs restyle`,
      )
  const yml = (await readdir(join(themeDir, 'src'))).find((f) =>
    f.endsWith('.yml'),
  )
  const themeVersion = (
    await readFile(join(themeDir, 'src', yml), 'utf8')
  ).match(/^version: (.+)$/m)[1]
  const themeTag = `${folder}-v${themeVersion}`
  const released = execFileSync('git', ['tag', '--list', themeTag], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  restyling.push({ themeTag, released, list })
  if (released) continue
  const sentence = restyledBeside(list)
  const section = (await readFile(join(themeDir, 'CHANGELOG.md'), 'utf8'))
    .split(/^## /m)
    .find(
      (s) =>
        s.startsWith(`${themeVersion}\n`) || s.startsWith(`${themeVersion} `),
    )
  if (!section?.includes(sentence))
    problems.push(
      `plugins/${folder}/CHANGELOG.md's "## ${themeVersion}" section should say:\n  ${sentence}`,
    )
  latestRestyles ??= Object.fromEntries(
    await Promise.all(
      restyled().map(async (r) => [r.key, await latestRestyled(r)]),
    ),
  )
  for (const r of list) {
    const latest = latestRestyles[r.key]
    if (!latest.current)
      problems.push(
        `${themeTag} would ship tested beside ${r.name} ${r.version}, but ${latest.version} is out: pin its files in tests/stash/companions.mjs (RESTYLED.${r.key}) and run the theme's specs`,
      )
  }
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
for (const { themeTag, released, list } of restyling)
  console.log(
    released
      ? `${themeTag} is released; its README names ${list.map((r) => `${r.name} ${r.version}`).join(' and ')}`
      : `${themeTag} is tested beside the latest ${list.map((r) => r.name).join(' and ')} and says so`,
  )
