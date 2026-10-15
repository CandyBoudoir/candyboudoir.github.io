// Keeps one GitHub issue per failing channel (stable, candidate, develop) in
// step with the latest compatibility run, closes it once the channel passes,
// and opens a "Support Stash vX.Y.Z" issue when Stash ships a stable release
// that tests/stash-versions.json does not list yet. Reads the status-*.json
// files the test jobs upload. Needs GH_TOKEN, GITHUB_REPOSITORY, RUN_URL and
// NEW_STABLE.
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'status'
const runUrl = process.env.RUN_URL
const newStable = process.env.NEW_STABLE

const gh = (...args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  })
const openIssue = (label) =>
  JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'open',
      '--label',
      label,
      '--json',
      'number,body',
      '--limit',
      '1',
    ),
  )[0]

const LABELS = {
  'compat:stable': ['b60205', 'A plugin fails on a supported Stash version'],
  'compat:candidate': [
    'd93f0b',
    'A plugin fails on a new Stash stable release',
  ],
  'compat:develop': [
    'fbca04',
    'A plugin fails on the latest Stash develop build',
  ],
  'stash-release': [
    '0e8a16',
    'Stash shipped a stable release the plugins do not list yet',
  ],
}
for (const [name, [color, description]] of Object.entries(LABELS)) {
  gh(
    'label',
    'create',
    name,
    '--color',
    color,
    '--description',
    description,
    '--force',
  )
}

const statuses = []
for (const f of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
  statuses.push(JSON.parse(await readFile(join(dir, f), 'utf8')))
}

for (const channel of ['stable', 'candidate', 'develop']) {
  const legs = statuses.filter((s) => s.channel === channel)
  const failing = legs.filter(
    (s) =>
      s.prepare !== 'success' ||
      s.contract !== 'success' ||
      (channel === 'stable' && s.visual !== 'success'),
  )
  const label = `compat:${channel}`
  const existing = openIssue(label)
  if (!failing.length) {
    if (existing && legs.length) {
      gh(
        'issue',
        'close',
        String(existing.number),
        '--comment',
        `Passing again in ${runUrl}.`,
      )
    }
    continue
  }
  const body = [
    `The latest compatibility run found problems on the ${channel} channel: ${runUrl}`,
    '',
    '| Stash | Build | Setup and install | Elements the plugins depend on | Screenshots |',
    '| --- | --- | --- | --- | --- |',
    ...failing.map(
      (s) =>
        `| ${s.leg} | \`${s.version}\` | ${s.prepare} | ${s.contract} | ${s.visual} |`,
    ),
    '',
    ...failing
      .filter((s) => s.unmatched)
      .map(
        (s) =>
          `Classes the plugins style that matched nothing on ${s.leg}, by plugin folder:\n\n\`\`\`\n${s.unmatched}\n\`\`\``,
      ),
    '',
    'The workflow run has the Playwright report and screenshot diffs as an artifact.',
  ].join('\n')
  const title = `Compatibility: failing on Stash ${channel === 'develop' ? 'develop' : failing.map((s) => s.leg).join(', ')}`
  if (!existing) {
    gh('issue', 'create', '--title', title, '--label', label, '--body', body)
  } else if (existing.body !== body) {
    const versionsChanged = !failing.every((s) =>
      existing.body.includes(s.version),
    )
    gh(
      'issue',
      'edit',
      String(existing.number),
      '--title',
      title,
      '--body',
      body,
    )
    if (versionsChanged) {
      gh(
        'issue',
        'comment',
        String(existing.number),
        '--body',
        `Still failing on a newer build: ${runUrl}`,
      )
    }
  }
}

if (newStable) {
  const titled = JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'all',
      '--label',
      'stash-release',
      '--search',
      newStable,
      '--json',
      'title',
    ),
  ).some((i) => i.title.includes(newStable))
  if (!titled) {
    const candidate = statuses.find((s) => s.leg === newStable)
    gh(
      'issue',
      'create',
      '--title',
      `Support Stash ${newStable}`,
      '--label',
      'stash-release',
      '--body',
      [
        `Stash ${newStable} is out: https://github.com/stashapp/stash/releases/tag/${newStable}`,
        '',
        candidate
          ? `The plugins on ${newStable}: setup ${candidate.prepare}, elements ${candidate.contract}, screenshots ${candidate.visual} (${runUrl}).`
          : `The run that noticed it: ${runUrl}`,
        '',
        'To support it: add it at the top of tests/stash-versions.json, give the previous version an until date 60 days out, refresh the screenshot baselines and release.',
      ].join('\n'),
    )
  }
}
