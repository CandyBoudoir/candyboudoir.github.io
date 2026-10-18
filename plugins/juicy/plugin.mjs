// Juicy's part of the build: what goes into the Theme-Juicy plugin folder and
// the pages Juicy adds under /juicy/ on the site.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const src = join(here, 'src')
const fontPkg = join(root, 'node_modules', '@fontsource-variable', 'fredoka')

export const id = 'Theme-Juicy'
export const title = 'Juicy'
// A theme restyles all of Stash, and Cherry Pick's specs run under each one.
export const kind = 'theme'
// The line about the plugin in the repo's README (scripts/readme.mjs).
export const summary =
  'A pink, playful theme: glossy candy stickers, gold hearts for ratings, a gum-bubble loader and a little cheek in the wording.'
// Juicy shipped from its own source at /juicy/index.yml before the shared one
// existed, and Stash checks for updates only at the source a plugin came from,
// so the build keeps publishing a source there with Juicy alone.
export const legacySource = true
// Paths in this folder whose changes alter the plugin zip. Tests, docs and the
// design-system page are left out so changing them offers users no update.
export const inputs = ['src', 'plugin.mjs']

export async function build(out) {
  await mkdir(join(out, 'assets', 'icons'), { recursive: true })
  await mkdir(join(out, 'assets', 'fonts'), { recursive: true })

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
  await writeFile(join(out, 'juicy.css'), css.join('\n'))

  await cp(join(src, 'js', 'juicy.js'), join(out, 'juicy.js'))
  await cp(join(src, `${id}.yml`), join(out, `${id}.yml`))
  await cp(join(src, 'icons'), join(out, 'assets', 'icons'), {
    recursive: true,
  })

  for (const subset of ['latin', 'latin-ext']) {
    const file = `fredoka-${subset}-wght-normal.woff2`
    await cp(join(fontPkg, 'files', file), join(out, 'assets', 'fonts', file))
  }
  await cp(join(fontPkg, 'LICENSE'), join(out, 'assets', 'fonts', 'OFL.txt'))
}

// The design-system page at /juicy/. It loads the built theme from a copy of
// the plugin folder beside it, over Bootstrap 4.6 standing in for Stash.
export async function pages(dir, plugin) {
  await cp(join(here, 'design-system', 'index.html'), join(dir, 'index.html'))
  await cp(join(here, 'design-system', 'ds'), join(dir, 'ds'), {
    recursive: true,
  })
  await mkdir(join(dir, 'ds', 'vendor'), { recursive: true })
  await cp(
    join(root, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css'),
    join(dir, 'ds', 'vendor', 'bootstrap.min.css'),
  )
  await cp(plugin, join(dir, id), { recursive: true })
}
