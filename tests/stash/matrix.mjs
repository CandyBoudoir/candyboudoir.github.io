// Prints the compatibility matrix for GitHub Actions as `legs=<json>`, plus
// `new_stable=<tag>` when Stash has a stable release that
// tests/stash-versions.json does not list yet. Each companion plugin
// (companions.mjs) adds an optional leg on the baseline version with it
// installed, and Firefox and WebKit each add one that runs Cherry Pick's
// contract specs in that browser (the screenshots stay Chromium's). The tz
// leg runs Cherry Pick's contract specs on a Stash whose server is at UTC-7
// all year: Stash compares its timestamp filters with the server's local
// time, which a server in UTC never shows. A companion leg's `zips` keys the
// cache of its pinned zip (companion-zips.mjs) on the pin's sha256. Every leg
// also installs the plugins the themes restyle (RESTYLED) and those that
// plugins here extend (EXTENDED), whose pinned files and zips `pinned` keys
// on their commits, in a cache of their own.
import { readFile } from 'node:fs/promises'
import { COMPANIONS, EXTENDED, RESTYLED } from './companions.mjs'

const versions = JSON.parse(
  await readFile(new URL('../stash-versions.json', import.meta.url), 'utf8'),
)
const today = new Date().toISOString().slice(0, 10)

const legs = versions.stable
  .filter((v) => !v.until || v.until >= today)
  .map((v, i) => ({
    name: v.version,
    tag: v.version,
    channel: 'stable',
    baseline: i === 0,
  }))

const headers = process.env.GITHUB_TOKEN
  ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {}
const res = await fetch(
  'https://api.github.com/repos/stashapp/stash/releases/latest',
  { headers },
)
const latest = res.ok ? (await res.json()).tag_name : ''
const newStable =
  latest && !versions.stable.some((v) => v.version === latest) ? latest : ''
if (newStable) {
  legs.push({
    name: newStable,
    tag: newStable,
    channel: 'candidate',
    baseline: false,
  })
}
const baseline = legs.find((l) => l.baseline)
if (baseline)
  for (const key of Object.keys(COMPANIONS))
    legs.push({
      name: `${baseline.tag}+${key}`,
      tag: baseline.tag,
      channel: 'companion',
      baseline: false,
      companions: key,
      zips: COMPANIONS[key].package.sha256,
    })
if (baseline)
  for (const browser of ['firefox', 'webkit'])
    legs.push({
      name: `${baseline.tag} ${browser}`,
      tag: baseline.tag,
      channel: 'browser',
      baseline: false,
      browser,
    })
if (baseline)
  legs.push({
    name: `${baseline.tag} tz`,
    tag: baseline.tag,
    channel: 'timezone',
    baseline: false,
    tz: 'America/Phoenix',
  })
if (versions.develop) {
  legs.push({
    name: 'develop',
    tag: 'develop',
    channel: 'develop',
    baseline: false,
  })
}

const pinned = [...Object.values(RESTYLED), ...Object.values(EXTENDED)]
  .map((p) => p.commit)
  .join('-')
for (const leg of legs) leg.pinned = pinned

console.log(`legs=${JSON.stringify(legs)}`)
console.log(`new_stable=${newStable}`)
