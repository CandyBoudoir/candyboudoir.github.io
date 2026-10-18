// Keeps a copy of each companion's pinned zip (companions.mjs), fetched from
// its author once per pin, in COMPANION_ZIPS (default
// node_modules/.cache/companion-zips) under its sha256. prepare.mjs serves
// these copies to Stash from its own package source, so a test run adds
// nothing to the download counts on the author's releases, which are the only
// public install count their plugins have. The Compatibility workflow caches
// the folder on the pin's sha256. A copy whose sha256 no longer matches is
// fetched again, and a fetched zip must match its pin.
//
// The plugins the themes restyle (RESTYLED) are pinned as files, not a zip;
// their copies live in the same folder, under <id>-<commit>/.
//
// `node tests/stash/companion-zips.mjs` fetches those COMPANIONS names and
// the restyled plugins.
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { companions, restyled } from './companions.mjs'

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

// Where a restyled plugin's pinned files live
export const restyledDir = (r) => join(ZIPS, `${r.id}-${r.commit.slice(0, 12)}`)

export async function fetchRestyledFiles() {
  for (const r of restyled()) {
    const dir = restyledDir(r)
    await mkdir(dir, { recursive: true })
    let fetched = false
    for (const [name, pin] of Object.entries(r.files)) {
      const file = join(dir, name)
      const copy = await readFile(file).catch(() => null)
      if (copy && sha256(copy) === pin) continue
      const url = `${r.base}/${name}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${url} answered ${res.status}`)
      const body = Buffer.from(await res.arrayBuffer())
      if (sha256(body) !== pin)
        throw new Error(
          `${url} has sha256 ${sha256(body)}, not the pinned ${pin}`,
        )
      await writeFile(`${file}.part`, body)
      await rename(`${file}.part`, file)
      fetched = true
    }
    if (fetched) console.log(`Fetched ${r.name} ${r.version} from ${r.base}`)
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await fetchCompanionZips()
  await fetchRestyledFiles()
}
