// Checks that the live site serves what the Publish workflow built: for every
// index.yml in the build (the shared channels and each legacy source), the
// live index lists each built entry's sha256 and the live zip hashes to it.
// Pages takes a moment to update, so it retries for 5 minutes.
// Usage: node scripts/verify-live.mjs <built-site-dir> <live-base-url>
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const [siteDir, base] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const entriesOf = (yml) =>
  yml
    .split(/^- /m)
    .filter((block) => block.startsWith('id: '))
    .map((block) => ({
      id: block.match(/^id: (.+)$/m)[1],
      path: block.match(/^ {2}path: (.+)$/m)[1],
      sha256: block.match(/^ {2}sha256: ([0-9a-f]{64})$/m)[1],
    }))

async function check(index) {
  const dir = dirname(index) === '.' ? '' : `${dirname(index)}/`
  const expected = entriesOf(await readFile(join(siteDir, index), 'utf8'))
  let problems = []
  for (let attempt = 0; attempt < 20; attempt++) {
    const bust = `?v=${Date.now()}`
    problems = []
    try {
      const live = entriesOf(
        await (await fetch(`${base}/${index}${bust}`)).text(),
      )
      for (const e of expected) {
        const listed = live.find((l) => l.id === e.id)?.sha256
        const zip = Buffer.from(
          await (await fetch(`${base}/${dir}${e.path}${bust}`)).arrayBuffer(),
        )
        const actual = createHash('sha256').update(zip).digest('hex')
        if (listed !== e.sha256 || actual !== e.sha256)
          problems.push(
            `${e.id}: index lists ${listed}, zip hashes to ${actual}, build was ${e.sha256}`,
          )
      }
      if (live.length !== expected.length)
        problems.push(
          `live lists ${live.length} plugins, build has ${expected.length}`,
        )
    } catch (e) {
      problems.push(e.message)
    }
    if (!problems.length) {
      console.log(`${index}: live index and zips match the build`)
      return true
    }
    await sleep(15000)
  }
  console.error(`${index}: ${problems.join('; ')}`)
  return false
}

const indexes = (await readdir(siteDir, { recursive: true }))
  .filter((f) => f === 'index.yml' || f.endsWith('/index.yml'))
  .sort()
const results = []
for (const index of indexes) results.push(await check(index))
process.exit(results.every(Boolean) ? 0 : 1)
