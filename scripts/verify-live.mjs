// Checks that the live plugin source serves what the Publish workflow built:
// for each channel, the live index.yml lists the built sha256 and the live zip
// hashes to it. Pages takes a moment to update, so it retries for 5 minutes.
// Usage: node scripts/verify-live.mjs <built-site-dir> <live-base-url>
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const [siteDir, base] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shaOf = (yml) => yml.match(/sha256: ([0-9a-f]{64})/)?.[1]

async function check(channel) {
  const prefix = channel === 'stable' ? '' : `${channel}/`
  const expected = shaOf(
    await readFile(join(siteDir, prefix, 'index.yml'), 'utf8'),
  )
  let problem = ''
  for (let attempt = 0; attempt < 20; attempt++) {
    const bust = `?v=${Date.now()}`
    try {
      const index = await (
        await fetch(`${base}/${prefix}index.yml${bust}`)
      ).text()
      const zip = Buffer.from(
        await (
          await fetch(`${base}/${prefix}Theme-Juicy.zip${bust}`)
        ).arrayBuffer(),
      )
      const listed = shaOf(index)
      const actual = createHash('sha256').update(zip).digest('hex')
      if (listed === expected && actual === expected) {
        console.log(`${channel}: live index and zip match ${expected}`)
        return true
      }
      problem = `index lists ${listed}, zip hashes to ${actual}, build was ${expected}`
    } catch (e) {
      problem = e.message
    }
    await sleep(15000)
  }
  console.error(`${channel}: ${problem}`)
  return false
}

const results = [await check('stable'), await check('develop')]
process.exit(results.every(Boolean) ? 0 : 1)
