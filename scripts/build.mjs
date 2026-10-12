// Builds the publishable site into dist/site:
//   Theme-Juicy/       the plugin folder (also what deploy-local.sh copies)
//   Theme-Juicy.zip    the same folder, zipped for the plugin source
//   index.yml          the Stash plugin source index
//   index.html, ds/    the design-system page
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const site = join(root, 'dist', 'site')
const pluginId = 'Theme-Juicy'
const plugin = join(site, pluginId)
const fontPkg = join(root, 'node_modules', '@fontsource-variable', 'fredoka')
// Paths whose changes alter the plugin zip. The lockfile is left out so dev
// tool bumps don't offer users an update; a Fredoka bump ships with the next
// change to these.
const pluginInputs = ['src', 'LICENSE', 'scripts/build.mjs']

async function buildPlugin() {
  await mkdir(join(plugin, 'assets', 'icons'), { recursive: true })
  await mkdir(join(plugin, 'assets', 'fonts'), { recursive: true })

  // CSS: concatenate the numbered partials in order, one file for Stash to serve.
  const cssDir = join(src, 'css')
  const partials = (await readdir(cssDir))
    .filter((f) => f.endsWith('.css'))
    .sort()
  const css = await Promise.all(
    partials.map(
      async (f) => `/* ${f} */\n${await readFile(join(cssDir, f), 'utf8')}`,
    ),
  )
  await writeFile(join(plugin, 'juicy.css'), css.join('\n'))

  await cp(join(src, 'js', 'juicy.js'), join(plugin, 'juicy.js'))
  await cp(join(src, `${pluginId}.yml`), join(plugin, `${pluginId}.yml`))
  await cp(join(src, 'icons'), join(plugin, 'assets', 'icons'), {
    recursive: true,
  })

  for (const subset of ['latin', 'latin-ext']) {
    const file = `fredoka-${subset}-wght-normal.woff2`
    await cp(
      join(fontPkg, 'files', file),
      join(plugin, 'assets', 'fonts', file),
    )
  }
  await cp(join(fontPkg, 'LICENSE'), join(plugin, 'assets', 'fonts', 'OFL.txt'))
  await cp(join(root, 'LICENSE'), join(plugin, 'LICENSE'))
}

async function buildSource() {
  const zip = join(site, `${pluginId}.zip`)
  // -X drops extra file attributes so the zip only changes when content does.
  execFileSync('zip', ['-q', '-r', '-X', zip, '.'], { cwd: plugin })
  const sha256 = createHash('sha256')
    .update(await readFile(zip))
    .digest('hex')

  const manifest = await readFile(join(src, `${pluginId}.yml`), 'utf8')
  const field = (name) =>
    manifest.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1]
  // JSON strings are valid YAML, so a ': ' in the name or description can't
  // break the index.
  const quoted = (name) => JSON.stringify(field(name))

  // Stash offers an update when `date` moves forward; `version` is display only.
  // Both come from the last commit that changed what goes into the zip, so a
  // rebuild with no plugin changes offers no update.
  const [commit, epoch] = execFileSync(
    'git',
    ['log', '-1', '--format=%h %ct', '--', ...pluginInputs],
    { cwd: root },
  )
    .toString()
    .trim()
    .split(' ')
  const date = new Date(Number(epoch) * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)

  const index = [
    `- id: ${pluginId}`,
    `  name: ${quoted('name')}`,
    `  metadata:`,
    `    description: ${quoted('description')}`,
    `  version: ${field('version')}-${commit}`,
    `  date: ${date}`,
    `  path: ${pluginId}.zip`,
    `  sha256: ${sha256}`,
    '',
  ].join('\n')
  await writeFile(join(site, 'index.yml'), index)
}

async function buildDesignSystem() {
  await cp(join(root, 'design-system', 'index.html'), join(site, 'index.html'))
  await cp(join(root, 'design-system', 'ds'), join(site, 'ds'), {
    recursive: true,
  })
  await mkdir(join(site, 'ds', 'vendor'), { recursive: true })
  await cp(
    join(root, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css'),
    join(site, 'ds', 'vendor', 'bootstrap.min.css'),
  )
}

await rm(site, { recursive: true, force: true })
await buildPlugin()
await buildSource()
await buildDesignSystem()
console.log(`Built ${site}`)
