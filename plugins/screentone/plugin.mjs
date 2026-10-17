// Screentone's part of the build: what goes into the Theme-Screentone plugin
// folder and the design-system page Screentone adds under /screentone/ on the
// site.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'Theme-Screentone'
export const title = 'Screentone'
// Paths in this folder whose changes alter the plugin zip. Tests, docs, tools
// and the design-system page are left out so changing them offers users no
// update.
export const inputs = ['src', 'plugin.mjs']

const LATIN = ['latin', 'latin-ext']

// The fonts Screentone bundles: the files it loads and each family's license.
// Dela Gothic One's kana come from src/fonts, a subset holding only the
// characters the SFX letter (tools/sfx-subset.py).
const FONTS = [
  {
    dir: 'dela-gothic-one',
    pkg: join(modules, '@fontsource', 'dela-gothic-one'),
    files: LATIN.map((subset) => `dela-gothic-one-${subset}-400-normal.woff2`),
  },
  {
    dir: 'caveat-brush',
    pkg: join(modules, '@fontsource', 'caveat-brush'),
    files: LATIN.map((subset) => `caveat-brush-${subset}-400-normal.woff2`),
  },
  {
    dir: 'zen-kaku-gothic-new',
    pkg: join(modules, '@fontsource', 'zen-kaku-gothic-new'),
    files: LATIN.flatMap((subset) =>
      ['400', '500', '700', '900'].map(
        (weight) => `zen-kaku-gothic-new-${subset}-${weight}-normal.woff2`,
      ),
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
  await writeFile(join(out, 'screentone.css'), css.join('\n'))

  await cp(join(src, 'js', 'screentone.js'), join(out, 'screentone.js'))
  await cp(join(src, `${id}.yml`), join(out, `${id}.yml`))
  await cp(join(src, 'icons'), join(out, 'assets', 'icons'), {
    recursive: true,
  })

  await cp(join(src, 'fonts'), join(out, 'assets', 'fonts'), {
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

// The design-system page at /screentone/. It loads the built theme from a copy
// of the plugin folder beside it, over Bootstrap 4.6 standing in for Stash.
// The hero figures and the motif sheets appear only on this page, so they live
// with it and stay out of the plugin zip.
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
