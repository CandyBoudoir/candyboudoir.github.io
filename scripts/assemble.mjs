// Puts the two channels together into the site GitHub Pages serves:
//   /                    the stable channel (scripts/stable.mjs)
//   /develop/            the develop channel (pnpm build on main)
//   /<folder>/develop/   for a plugin with a legacy source, its develop source,
//                        so /juicy/develop/index.yml keeps working too
// Usage: node scripts/assemble.mjs <stable-dir> <develop-dist-dir> <out>
import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const [stable, develop, out] = process.argv.slice(2).map((p) => resolve(p))
const developSite = join(develop, 'site')

await rm(out, { recursive: true, force: true })
await cp(stable, out, { recursive: true })
await cp(developSite, join(out, 'develop'), { recursive: true })

const entries = JSON.parse(
  await readFile(join(develop, 'entries.json'), 'utf8'),
)
for (const e of entries.filter((e) => e.legacy)) {
  const dir = join(out, e.folder, 'develop')
  await mkdir(dir, { recursive: true })
  for (const f of ['index.yml', `${e.id}.zip`])
    await cp(join(developSite, e.folder, f), join(dir, f))
}
