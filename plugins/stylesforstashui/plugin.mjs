// Styles for Stash UI's part of the build: what goes into the StylesForStashUI
// plugin folder. Stash UI, another author's replacement interface, imports
// assets/stashui.js from every enabled plugin, so everything this plugin ships
// sits in its assets: the module, one stylesheet and the fonts and glyphs the
// styles use.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'StylesForStashUI'
export const title = 'Styles for Stash UI'
// The line about the plugin in the repo's README (scripts/readme.mjs).
export const summary =
  "City Pop and Overclock as styles for Stash UI, another author's replacement interface: their colours, type and backdrops, picked under its Colors."
// Paths in this folder whose changes alter the plugin zip. Tests and docs are
// left out so changing them offers users no update.
export const inputs = ['src', 'plugin.mjs']

// The fonts the styles bundle: the files they load and each family's license,
// the same files City Pop and Overclock ship.
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

  await cp(join(src, 'stashui.js'), join(assets, 'stashui.js'))
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
