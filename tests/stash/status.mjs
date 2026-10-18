// Writes status/<leg>.json for the report job: the leg, the Stash build it ran,
// the outcome of each step, the outcome of each test step for each plugin
// folder (from the Playwright JSON reports in pw-results/, results.mjs), and
// the classes each plugin styles that newly matched nothing
// (pw-results/<folder>-newly-missing-classes.txt, written by the contract
// tests). Step outcomes arrive as env vars.
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stepOutcomes } from './results.mjs'

const read = (file) =>
  readFile(file, 'utf8').then(
    (s) => s.trim(),
    () => '',
  )
const leg = process.env.LEG
const SUFFIX = '-newly-missing-classes.txt'
const missing = []
for (const file of (await readdir('pw-results').catch(() => []))
  .filter((f) => f.endsWith(SUFFIX))
  .sort()) {
  const classes = await read(join('pw-results', file))
  if (classes) missing.push(`${file.slice(0, -SUFFIX.length)}:\n${classes}`)
}
const folders = (await readdir('plugins', { withFileTypes: true }))
  .filter((d) => existsSync(join('plugins', d.name, 'plugin.mjs')))
  .map((d) => d.name)
  .sort()
const report = (step) =>
  read(join('pw-results', `${step}.json`)).then((s) => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  })
const contract = process.env.CONTRACT || 'skipped'
const visual = process.env.VISUAL_OUTCOME || 'skipped'
const byStep = {
  contract: stepOutcomes(contract, await report('contract'), folders),
  visual: stepOutcomes(visual, await report('visual'), folders),
}
const status = {
  leg,
  channel: process.env.CHANNEL,
  version:
    (await read(join(process.env.WORK, 'version.txt'))).split(' ')[0] || leg,
  prepare: process.env.PREPARE || 'skipped',
  contract,
  visual,
  plugins: Object.fromEntries(
    folders.map((f) => [
      f,
      { contract: byStep.contract[f], visual: byStep.visual[f] },
    ]),
  ),
  unmatched: missing.join('\n\n'),
}
await mkdir('status', { recursive: true })
await writeFile(join('status', `${leg}.json`), JSON.stringify(status, null, 2))
console.log(status)
