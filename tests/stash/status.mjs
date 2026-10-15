// Writes status/<leg>.json for the report job: the leg, the Stash build it ran,
// the outcome of each step, and the classes each plugin styles that newly
// matched nothing (test-results/<folder>-newly-missing-classes.txt, written by
// the contract tests). Step outcomes arrive as env vars.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const read = (file) =>
  readFile(file, 'utf8').then(
    (s) => s.trim(),
    () => '',
  )
const leg = process.env.LEG
const SUFFIX = '-newly-missing-classes.txt'
const missing = []
for (const file of (await readdir('test-results').catch(() => []))
  .filter((f) => f.endsWith(SUFFIX))
  .sort()) {
  const classes = await read(join('test-results', file))
  if (classes) missing.push(`${file.slice(0, -SUFFIX.length)}:\n${classes}`)
}
const status = {
  leg,
  channel: process.env.CHANNEL,
  version:
    (await read(join(process.env.WORK, 'version.txt'))).split(' ')[0] || leg,
  prepare: process.env.PREPARE || 'skipped',
  contract: process.env.CONTRACT || 'skipped',
  visual: process.env.VISUAL_OUTCOME || 'skipped',
  unmatched: missing.join('\n\n'),
}
await mkdir('status', { recursive: true })
await writeFile(join('status', `${leg}.json`), JSON.stringify(status, null, 2))
console.log(status)
