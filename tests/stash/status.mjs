// Writes status/<leg>.json for the report job: the leg, the Stash build it ran
// and the outcome of each step. Step outcomes arrive as env vars.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const read = (file) =>
  readFile(file, 'utf8').then(
    (s) => s.trim(),
    () => '',
  )
const leg = process.env.LEG
const status = {
  leg,
  channel: process.env.CHANNEL,
  version:
    (await read(join(process.env.WORK, 'version.txt'))).split(' ')[0] || leg,
  prepare: process.env.PREPARE || 'skipped',
  contract: process.env.CONTRACT || 'skipped',
  visual: process.env.VISUAL_OUTCOME || 'skipped',
  unmatched: await read('test-results/newly-missing-classes.txt'),
}
await mkdir('status', { recursive: true })
await writeFile(join('status', `${leg}.json`), JSON.stringify(status, null, 2))
console.log(status)
