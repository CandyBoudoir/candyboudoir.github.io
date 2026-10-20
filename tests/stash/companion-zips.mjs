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
// their copies live in the same folder, under <id>-<commit>/. The plugins
// that plugins here extend (EXTENDED) are pinned to a commit in the author's
// git repository; each one's zip, built here from its plugin folder at that
// commit, lives there as <id>-<commit>.zip.
//
// `node tests/stash/companion-zips.mjs` fetches those COMPANIONS names, the
// restyled plugins and the extended ones.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipFolder } from '../../scripts/site.mjs'
import { companions, extended, restyled } from './companions.mjs'

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

// Where the zip of an extended plugin's pinned folder lives
export const extendedZip = (e) =>
  join(ZIPS, `${e.id}-${e.commit.slice(0, 12)}.zip`)

// The pinned commit's plugin folder in a folder of its own: a shallow fetch
// of that commit alone, whose hash is the content's
export async function checkoutExtended(e, dir) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  await mkdir(join(dir, 'repo'), { recursive: true })
  const repo = (...args) => git('-C', 'repo', ...args)
  repo('init', '-q')
  repo(
    'fetch',
    '-q',
    '--depth',
    '1',
    '--no-tags',
    `https://github.com/${e.repo}.git`,
    e.commit,
  )
  const [commit, epoch] = repo('log', '-1', '--format=%H %ct', 'FETCH_HEAD')
    .trim()
    .split(' ')
  if (commit !== e.commit)
    throw new Error(`${e.repo} answered ${commit} for ${e.commit}`)
  // As committed, without the attributes or line endings a checkout applies
  const folder = join(dir, e.id)
  await mkdir(folder)
  execFileSync('tar', ['-x', '-C', folder], {
    input: execFileSync(
      'git',
      ['-C', 'repo', 'archive', '--format=tar', `${commit}:${e.folder}`],
      { cwd: dir, maxBuffer: 256 * 1024 * 1024 },
    ),
  })
  const manifest = await readFile(join(folder, `${e.id}.yml`), 'utf8')
  const version = manifest.match(/^version:\s*['"]?([^'"\s]+)/m)?.[1]
  const date = new Date(Number(epoch) * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)
  return { folder, version, date, epoch }
}

export async function fetchExtendedZips() {
  await mkdir(ZIPS, { recursive: true })
  for (const e of extended()) {
    const file = extendedZip(e)
    if (
      await stat(file).then(
        (s) => s.isFile(),
        () => false,
      )
    )
      continue
    const dir = await mkdtemp(join(tmpdir(), 'extended-'))
    try {
      const { folder, version, date, epoch } = await checkoutExtended(e, dir)
      if (version !== e.version || date !== e.date)
        throw new Error(
          `${e.folder} at ${e.commit} is ${e.name} ${version} of ${date}, not the pinned ${e.version} of ${e.date}`,
        )
      const zip = join(dir, `${e.id}.zip`)
      await zipFolder(folder, zip, epoch)
      await copyFile(zip, `${file}.part`)
      await rename(`${file}.part`, file)
      console.log(
        `Fetched ${e.name} ${e.version} from ${e.repo} at ${e.commit.slice(0, 12)}`,
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}

// The extended plugins as packages for the source prepare.mjs serves, each
// with the sha256 of its zip
export const extendedPackages = () =>
  Promise.all(
    extended().map(async (e) => ({
      ...e,
      file: extendedZip(e),
      sha256: sha256(await readFile(extendedZip(e))),
    })),
  )

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await fetchCompanionZips()
  await fetchRestyledFiles()
  await fetchExtendedZips()
}
