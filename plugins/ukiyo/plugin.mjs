// Ukiyo's part of the build: what goes into the Theme-Ukiyo plugin folder and
// the design-system page Ukiyo adds under /ukiyo/ on the site.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const modules = join(root, 'node_modules')

export const id = 'Theme-Ukiyo'
export const title = 'Ukiyo'
// Paths in this folder whose changes alter the plugin zip. Tests, docs, tools
// and the design-system page are left out so changing them offers users no
// update.
export const inputs = ['src', 'plugin.mjs']

// The fonts Ukiyo bundles: the files it loads and each family's license. Only
// the Latin subsets ship; the few Japanese characters Ukiyo prints are SVG
// outlines in its seals, so no Japanese font is needed.
const FONTS = [
  {
    dir: 'shippori-mincho-b1',
    pkg: join(modules, '@fontsource', 'shippori-mincho-b1'),
    files: ['latin', 'latin-ext'].flatMap((subset) =>
      ['500', '700', '800'].map(
        (weight) => `shippori-mincho-b1-${subset}-${weight}-normal.woff2`,
      ),
    ),
  },
  {
    dir: 'zen-kaku-gothic-new',
    pkg: join(modules, '@fontsource', 'zen-kaku-gothic-new'),
    files: ['latin', 'latin-ext'].flatMap((subset) =>
      ['500', '700'].map(
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
  await writeFile(join(out, 'ukiyo.css'), css.join('\n'))

  await cp(join(src, 'js', 'ukiyo.js'), join(out, 'ukiyo.js'))
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

// The design-system page at /ukiyo/. It loads the built theme from a copy of
// the plugin folder beside it, over Bootstrap 4.6 standing in for Stash. The
// whole night print and the motif drawings appear only on this page, so they
// live with it and stay out of the plugin zip.
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
