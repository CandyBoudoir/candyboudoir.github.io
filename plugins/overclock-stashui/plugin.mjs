// Overclock for Stash UI's part of the build: what goes into the StashUI-Overclock plugin folder.
// Stash UI, another author's replacement interface, imports assets/stashui.js
// from every enabled plugin, so everything this plugin ships sits in its
// assets: the module, which bundles the shared Stash UI style kit
// (shared/stashui/style.js) with Overclock's colours, one stylesheet, and
// the fonts and glyphs it uses, the same files Overclock ships.
import { build as esbuild } from 'esbuild'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'StashUI-Overclock'
export const title = 'Overclock for Stash UI'
// The line about the plugin in the repo's README (scripts/readme.mjs).
export const summary =
  'Brings the Classic Stash theme, Overclock, to Stash UI: its acid yellow, glitch-split titles and HUD backdrop. Needs Stash UI.'
// Paths whose changes alter the plugin zip: this folder's sources and the
// shared kit. Tests and docs are left out so changing them offers users no
// update.
export const inputs = ['src', 'plugin.mjs', '../../shared/stashui']

// The fonts the style bundles: the files it loads and each family's license.
const FONTS = [
  {
    dir: 'chakra-petch',
    pkg: join(modules, '@fontsource', 'chakra-petch'),
    files: ['latin', 'latin-ext'].flatMap((subset) =>
      ['500', '600', '700'].map(
        (weight) => `chakra-petch-${subset}-${weight}-normal.woff2`,
      ),
    ),
  },
  {
    dir: 'share-tech-mono',
    pkg: join(modules, '@fontsource', 'share-tech-mono'),
    files: ['share-tech-mono-latin-400-normal.woff2'],
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
