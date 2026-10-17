// Keeps a copy of each companion's pinned zip (companions.mjs), fetched from
// its author once per pin, in COMPANION_ZIPS (default
// node_modules/.cache/companion-zips) under its sha256. prepare.mjs serves
// these copies to Stash from its own package source, so a test run adds
// nothing to the download counts on the author's releases, which are the only
// public install count their plugins have. The Compatibility workflow caches
// the folder on the pin's sha256. A copy whose sha256 no longer matches is
// fetched again, and a fetched zip must match its pin.
//
// `node tests/stash/companion-zips.mjs` fetches those COMPANIONS names.
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { companions } from './companions.mjs'

export const ZIPS = resolve(
  process.env.COMPANION_ZIPS ?? 'node_modules/.cache/companion-zips',
)

// Where the copy of a pinned package's zip lives
export const zipFile = (p) => join(ZIPS, `${p.sha256}.zip`)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

export async function fetchCompanionZips() {
  await mkdir(ZIPS, { recursive: true })
  for (const { package: p } of companions()) {
    const file = zipFile(p)
    const copy = await readFile(file).catch(() => null)
    if (copy && sha256(copy) === p.sha256) continue
    const res = await fetch(p.path)
    if (!res.ok) throw new Error(`${p.path} answered ${res.status}`)
    const zip = Buffer.from(await res.arrayBuffer())
    if (sha256(zip) !== p.sha256)
      throw new Error(
        `${p.path} has sha256 ${sha256(zip)}, not the pinned ${p.sha256}`,
      )
    await writeFile(`${file}.part`, zip)
    await rename(`${file}.part`, file)
    console.log(`Fetched ${p.name} ${p.version} from ${p.path}`)
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url))
  await fetchCompanionZips()
