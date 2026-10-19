// New Releases' part of the build: what goes into the NewReleases plugin
// folder. The page is ES modules and JSX under src/js, bundled by esbuild
// into one classic script against window.PluginApi.React, as Cherry Pick's
// is. The task is one Python script, run with Stash's own Python.
import { build as esbuild } from 'esbuild'
import { cp, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, 'src')

export const id = 'NewReleases'
export const title = 'New Releases'
// The line about the plugin in the repo's README (scripts/readme.mjs).
export const summary =
  'The newest releases from your favourite studios, from ThePornDB and your other stash-boxes, filtered by tag, performer and studio, each linked to the studio to buy it.'
// Still being built: built and tested, never published or released.
export const incubating = true
// Paths in this folder whose changes alter the plugin zip. Tests and docs are
// left out so changing them offers users no update.
export const inputs = ['src', 'plugin.mjs']

export async function build(out) {
  await esbuild({
    entryPoints: [join(src, 'js', 'main.jsx')],
    outfile: join(out, 'newreleases.js'),
    bundle: true,
    format: 'iife',
    target: 'es2020',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    inject: [join(src, 'js', 'react-shim.js')],
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'warning',
  })

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
  await writeFile(join(out, 'newreleases.css'), css.join('\n'))

  await cp(join(src, 'py', 'newreleases.py'), join(out, 'newreleases.py'))
  await cp(join(src, `${id}.yml`), join(out, `${id}.yml`))
}
