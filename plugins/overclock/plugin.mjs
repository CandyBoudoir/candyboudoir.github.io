// Overclock's part of the build: what goes into the Theme-Overclock plugin
// folder and the design-system page Overclock adds under /overclock/ on the site.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'Theme-Overclock'
export const title = 'Overclock'
// A theme restyles all of Stash, and Cherry Pick's specs run under each one.
export const kind = 'theme'
// The line about the plugin in the repo's README (scripts/readme.mjs).
export const summary =
  "A hacker's heads-up display in acid yellow: charge chevrons for ratings, a reticle that locks on for favourites and a cold system voice."
// Paths in this folder whose changes alter the plugin zip. Tests, docs and the
// design-system page are left out so changing them offers users no update.
export const inputs = ['src', 'plugin.mjs']

// The fonts Overclock bundles: the files it loads and each family's license.
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
  await mkdir(join(out, 'assets', 'icons'), { recursive: true })

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
  await writeFile(join(out, 'overclock.css'), css.join('\n'))

  await cp(join(src, 'js', 'overclock.js'), join(out, 'overclock.js'))
  await cp(join(src, `${id}.yml`), join(out, `${id}.yml`))
  await cp(join(src, 'icons'), join(out, 'assets', 'icons'), {
    recursive: true,
  })

  for (const font of FONTS) {
    const dir = join(out, 'assets', 'fonts', font.dir)
    await mkdir(dir, { recursive: true })
    for (const file of font.files)
      await cp(join(font.pkg, 'files', file), join(dir, file))
    await cp(join(font.pkg, 'LICENSE'), join(dir, 'OFL.txt'))
  }
}

// The design-system page at /overclock/. It loads the built theme from a copy
// of the plugin folder beside it, over Bootstrap 4.6 standing in for Stash. The
// motifs only this page shows live with it and stay out of the plugin zip.
export async function pages(dir, plugin) {
  await cp(join(here, 'design-system', 'index.html'), join(dir, 'index.html'))
  await cp(join(here, 'design-system', 'ds'), join(dir, 'ds'), {
    recursive: true,
  })
  await mkdir(join(dir, 'ds', 'vendor'), { recursive: true })
  await cp(
    join(modules, 'bootstrap', 'dist', 'css', 'bootstrap.min.css'),
    join(dir, 'ds', 'vendor', 'bootstrap.min.css'),
  )
  await cp(plugin, join(dir, id), { recursive: true })
}
