// Builds the publishable site into dist/site from every plugin in plugins/:
//   <Id>/        each plugin's folder (what deploy-local.sh copies)
//   <Id>.zip     the same folder, zipped for the plugin source
//   index.yml    the CandyBoudoir plugin source, listing every plugin
//   index.html   a page listing the plugins and how to add the source
//   <name>/      a plugin's own pages, and for a plugin with legacySource a
//                source with that plugin alone (see plugins/juicy/plugin.mjs)
// `--only <name>[,<name>]` builds just those plugins; scripts/stable.mjs
// builds each plugin from its own release tag this way. dist/entries.json
// records the index entries for it.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildPlugin, listPlugins, root, writeSource } from './site.mjs'

const dist = join(root, 'dist')
const site = join(dist, 'site')
const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : null

const plugins = (await listPlugins()).filter(
  (p) => !only || only.includes(p.name),
)
if (only && plugins.length !== only.length)
  throw new Error(`No plugin folder for some of: ${only.join(', ')}`)

await rm(site, { recursive: true, force: true })
await mkdir(site, { recursive: true })
const entries = []
for (const plugin of plugins) entries.push(await buildPlugin(site, plugin))
await writeSource(site, entries)
await writeFile(join(dist, 'entries.json'), JSON.stringify(entries, null, 2))
console.log(`Built ${entries.map((e) => e.id).join(', ')} into ${site}`)
