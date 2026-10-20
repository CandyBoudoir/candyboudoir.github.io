// Keeps Cherry Pick tested beside the latest release of each companion plugin
// (companions.mjs), each theme beside the latest release of each plugin it
// restyles (RESTYLED), and each plugin that extends another author's
// (EXTENDED) beside the release that was latest when it released, and saying
// so.
//
// Always: the Tested with table in Cherry Pick's README names the Stash
// versions in stash-versions.json and the pinned companion versions, and the
// README of a restyling theme or an extending plugin names the pinned version
// of each plugin it restyles or extends.
// While a plugin's version has no <folder>-vX.Y.Z tag yet (a release on its
// way): that version's CHANGELOG section carries testedBeside() (Cherry Pick)
// or restyledBeside() (a restyling theme or an extending plugin), and every
// pin it names is its author's latest release. An extended plugin's pin may
// trail by a release out for less than a day (EXTENDED_GRACE_HOURS), and an
// incubating plugin, which never releases, is not checked against it.
// With --issues (the nightly Compatibility run): instead of failing, keeps one
// open "Test Cherry Pick beside <plugin> <version>" issue per companion with a
// newer release, and one "Restyle <plugin> <version>" issue per plugin the
// themes restyle (RESTYLED), and closes each once its pin catches up. Needs
// GH_TOKEN. The extended plugins get none: Stash UI releases several times a
// day, and each release of a plugin that extends it moves its pin.
//
// Reads the latest releases over the network, for a release and --issues
// only; GITHUB_TOKEN raises GitHub's rate limit.
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  COMPANIONS,
  RESTYLED,
  TESTED_PLUGIN,
  extendedBy,
  restyled,
  restyledBeside,
  restyledBy,
  testedBeside,
} from './companions.mjs'

// How long a release of an extended plugin can be out before a release of a
// plugin that extends it must move the pin to it
const EXTENDED_GRACE_HOURS = 24

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

// How far an extended plugin's pin trails its author: the version of the
// newest change to its folder, which the author's source serves, and when
// the first change after the pin came out
async function latestExtended(e) {
  const since = `${e.date.replace(' ', 'T')}Z`
  const commits = await (
    await get(
      `https://api.github.com/repos/${e.repo}/commits?path=${encodeURIComponent(e.folder)}&since=${since}&per_page=100`,
      { headers },
    )
  ).json()
  if (!commits.length)
    throw new Error(
      `${e.repo} lists no change to ${e.folder} since ${since}, the pinned commit's date`,
    )
  const at = commits.findIndex((c) => c.sha === e.commit)
  if (at === 0) return { version: e.version, current: true }
  const manifest = await (
    await get(
      `https://raw.githubusercontent.com/${e.repo}/${commits[0].sha}/${e.folder}/${e.id}.yml`,
    )
  ).text()
  return {
    version: manifest.match(/^version:\s*['"]?([^'"\s]+)/m)?.[1],
    current: false,
    // Unknown when the pin is not on the page, a hundred changes back
    overtaken: at > 0 ? commits[at - 1].commit.committer.date : null,
  }
}

// A plugin's version and tag, and whether the tag exists yet
async function releaseOf(folder) {
  const src = join(root, 'plugins', folder, 'src')
  const yml = (await readdir(src)).find((f) => f.endsWith('.yml'))
  const version = (await readFile(join(src, yml), 'utf8')).match(
    /^version: (.+)$/m,
  )[1]
  const tag = `${folder}-v${version}`
  const released = execFileSync('git', ['tag', '--list', tag], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  return { version, tag, released: Boolean(released) }
}

// A version's section of a plugin's CHANGELOG
const changelogSection = async (folder, version) =>
  (await readFile(join(root, 'plugins', folder, 'CHANGELOG.md'), 'utf8'))
    .split(/^## /m)
    .find((s) => s.startsWith(`${version}\n`) || s.startsWith(`${version} `))

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
          `Run \`node tests/stash/pin-restyled.mjs ${key}\`, which pins the files of the release commit in \`tests/stash/companions.mjs\` (RESTYLED.${key}) and moves the version those themes name. Then run their contract and visual specs, fix any class the release renamed (each theme's check against \`tests/${key}-unmatched-baseline.txt\` names them) and refresh their screenshot baselines.`,
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
  const {
    version: themeVersion,
    tag: themeTag,
    released,
  } = await releaseOf(folder)
  restyling.push({ themeTag, released, list })
  if (released) continue
  const sentence = restyledBeside(list)
  const section = await changelogSection(folder, themeVersion)
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

// The plugins that extend another author's plugin: the README names the
// pinned version of each, and a release on its way says what it was tested
// beside, which must have been the latest release within the day
const extending = []
for (const folder of (await readdir(join(root, 'plugins'))).sort()) {
  const list = extendedBy(folder)
  if (!list.length) continue
  const pluginDir = join(root, 'plugins', folder)
  const pluginReadme = await readFile(join(pluginDir, 'README.md'), 'utf8')
  for (const e of list)
    if (!pluginReadme.includes(`${e.name} ${e.version}`))
      problems.push(
        `plugins/${folder}/README.md should name ${e.name} ${e.version}, the release its specs run beside`,
      )
  const {
    version: pluginVersion,
    tag: pluginTag,
    released,
  } = await releaseOf(folder)
  const { incubating } = await import(
    pathToFileURL(join(pluginDir, 'plugin.mjs')).href
  )
  extending.push({ pluginTag, released, incubating, list })
  if (released) continue
  const sentence = restyledBeside(list)
  if (!(await changelogSection(folder, pluginVersion))?.includes(sentence))
    problems.push(
      `plugins/${folder}/CHANGELOG.md's "## ${pluginVersion}" section should say:\n  ${sentence}`,
    )
  if (incubating) continue
  for (const e of list) {
    const latest = await latestExtended(e)
    const late =
      !latest.current &&
      (!latest.overtaken ||
        Date.now() - Date.parse(latest.overtaken) >
          EXTENDED_GRACE_HOURS * 3600_000)
    console.log(
      `${e.name}: tested ${e.version}, latest ${latest.version}${latest.current ? '' : late ? ' (newer)' : ' (newer, out less than a day)'}`,
    )
    if (late)
      problems.push(
        `${pluginTag} would ship tested beside ${e.name} ${e.version}, but a newer release came out ${latest.overtaken ?? 'over a hundred changes ago'} and ${latest.version} is out: run node tests/stash/pin-extended.mjs ${e.key}, then the specs of ${e.extendedBy.join(', ')}`,
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
for (const { pluginTag, released, incubating, list } of extending) {
  const names = list.map((e) => `${e.name} ${e.version}`).join(' and ')
  console.log(
    released
      ? `${pluginTag} is released; its README names ${names}`
      : incubating
        ? `${pluginTag} is incubating; it names ${names}, which its release will need to be the latest`
        : `${pluginTag} is tested beside ${names}, the latest within the day, and says so`,
  )
}
