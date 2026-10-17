// City Pop's part of the build: what goes into the Theme-CityPop plugin folder
// and the design-system page City Pop adds under /citypop/ on the site.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'Theme-CityPop'
export const title = 'City Pop'
// Paths in this folder whose changes alter the plugin zip. Tests, docs, tools
// and the design-system page are left out so changing them offers users no
// update.
export const inputs = ['src', 'plugin.mjs']

// The fonts City Pop bundles: the files it loads and each family's license.
// Zen Maru Gothic is a subset holding only the Japanese characters the theme
// draws (tools/zen-maru.sh), committed under src/fonts with its license.
const FONTS = [
  {
    dir: 'mr-dafoe',
    pkg: join(modules, '@fontsource', 'mr-dafoe'),
    files: ['latin', 'latin-ext'].map(
      (subset) => `mr-dafoe-${subset}-400-normal.woff2`,
    ),
  },
  {
    dir: 'jost',
    pkg: join(modules, '@fontsource-variable', 'jost'),
    files: ['latin', 'latin-ext'].flatMap((subset) =>
      ['normal', 'italic'].map((style) => `jost-${subset}-wght-${style}.woff2`),
    ),
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
  await writeFile(join(out, 'citypop.css'), css.join('\n'))

  await cp(join(src, 'js', 'citypop.js'), join(out, 'citypop.js'))
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
  await cp(join(src, 'fonts'), join(out, 'assets', 'fonts'), {
    recursive: true,
  })
}

// The design-system page at /citypop/. It loads the built theme from a copy of
// the plugin folder beside it, over Bootstrap 4.6 standing in for Stash. The
// motifs and illustrations only this page shows live with it and stay out of
// the plugin zip.
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
