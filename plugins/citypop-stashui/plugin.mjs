// City Pop for Stash UI's part of the build: what goes into the StashUI-CityPop plugin folder.
// Stash UI, another author's replacement interface, imports assets/stashui.js
// from every enabled plugin, so everything this plugin ships sits in its
// assets: the module, which bundles the shared Stash UI style kit
// (shared/stashui/style.js) with City Pop's colours, one stylesheet, and
// the fonts and glyphs it uses, the same files City Pop ships.
import { build as esbuild } from 'esbuild'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'StashUI-CityPop'
export const title = 'City Pop for Stash UI'
// The line about the plugin in the repo's README (scripts/readme.mjs).
export const summary =
  'Brings the Classic Stash theme, City Pop, to Stash UI: its dusk colours, brush-script titles and backdrop of stars and palms. Needs Stash UI.'
// Paths whose changes alter the plugin zip: this folder's sources and the
// shared kit. Tests and docs are left out so changing them offers users no
// update.
export const inputs = ['src', 'plugin.mjs', '../../shared/stashui']

// The fonts the style bundles: the files it loads and each family's license.
const FONTS = [
  {
    dir: 'jost',
    pkg: join(modules, '@fontsource-variable', 'jost'),
    files: ['latin', 'latin-ext'].map(
      (subset) => `jost-${subset}-wght-normal.woff2`,
    ),
  },
  {
    dir: 'mr-dafoe',
    pkg: join(modules, '@fontsource', 'mr-dafoe'),
    files: ['latin', 'latin-ext'].map(
      (subset) => `mr-dafoe-${subset}-400-normal.woff2`,
    ),
  },
]

export async function build(out) {
  const assets = join(out, 'assets')
  await mkdir(join(assets, 'icons'), { recursive: true })

  // The module Stash UI imports: the style and the kit in one ES module file
  await esbuild({
    entryPoints: [join(src, 'stashui.js')],
    outfile: join(assets, 'stashui.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'warning',
  })

  // CSS: concatenate the numbered partials in order, one file for Stash UI
  // to load.
  const cssDir = join(src, 'css')
  const partials = (await readdir(cssDir))
    .filter((f) => f.endsWith('.css'))
    .sort()
  const css = await Promise.all(
    partials.map(
      async (f) => `/* ${f} */\n${await readFile(join(cssDir, f), 'utf8')}`,
    ),
  )
  await writeFile(join(assets, 'stashui.css'), css.join('\n'))

  await cp(join(src, `${id}.yml`), join(out, `${id}.yml`))
  await cp(join(src, 'icons'), join(assets, 'icons'), { recursive: true })

  for (const font of FONTS) {
    const dir = join(assets, 'fonts', font.dir)
    await mkdir(dir, { recursive: true })
    for (const file of font.files)
      await cp(join(font.pkg, 'files', file), join(dir, file))
    await cp(join(font.pkg, 'LICENSE'), join(dir, 'OFL.txt'))
  }
}
