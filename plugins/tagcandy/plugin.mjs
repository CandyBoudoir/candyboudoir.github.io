// Tag Candy's part of the build: what goes into the TagCandy plugin folder and
// the icons it publishes under /tagcandy/ on the site. Stash runs the script
// in its own JavaScript engine, which cannot read files, so the build bundles
// src/ into one script that carries the matching data from data/ as a JSON
// string the script parses only when a task or hook needs it.
import { build as esbuild } from 'esbuild'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIndex } from './lookup.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, 'src')

export const id = 'TagCandy'
export const title = 'Tag Candy'
// Paths in this folder whose changes alter the plugin zip. The icons are
// published on the site, not zipped, and tests and docs are left out, so
// changing them offers users no update.
export const inputs = ['src', 'plugin.mjs', 'lookup.mjs', 'data']

export const readBundle = async () =>
  JSON.parse(await readFile(join(here, 'data', 'concepts.json'), 'utf8'))

export async function build(out) {
  await buildScript(await readBundle(), join(out, 'tagcandy.js'))
  await cp(join(src, `${id}.yml`), join(out, `${id}.yml`))
}

// Bundles src/ with the index built from a bundle into one script. The tests
// call it with a changed bundle to try settings the shipped data cannot reach.
export async function buildScript(bundle, outfile) {
  const index = buildIndex(bundle)
  delete index.ambiguous
  const json = JSON.stringify(index)
  await esbuild({
    entryPoints: [join(src, 'main.js')],
    outfile,
    bundle: true,
    format: 'iife',
    globalName: 'TagCandy',
    // Stash's engine (goja) runs most of ES2015; esbuild lowers the rest.
    target: 'es2015',
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'warning',
    // Stash takes the script's last expression as the task's result.
    footer: { js: 'TagCandy.result;' },
    plugins: [
      {
        name: 'tagcandy-data',
        setup(b) {
          b.onResolve({ filter: /^tagcandy:data$/ }, () => ({
            path: 'data',
            namespace: 'tagcandy',
          }))
          b.onLoad({ filter: /.*/, namespace: 'tagcandy' }, () => ({
            contents: `export default ${JSON.stringify(json)}`,
            loader: 'js',
          }))
        },
      },
    ],
  })
}

// The site's /tagcandy/: every icon, under the name the scripts ask for, and
// a page that shows them.
export async function pages(dir) {
  await cp(join(here, 'icons'), join(dir, 'icons'), { recursive: true })
  const bundle = await readBundle()
  const names = new Map(
    bundle.concepts.filter((c) => c.icon).map((c) => [c.icon, c.name]),
  )
  const files = (await readdir(join(here, 'icons'))).sort()
  const esc = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    )
  const tiles = files
    .filter((f) => names.has(f))
    .sort((a, b) => names.get(a).localeCompare(names.get(b)))
    .map(
      (f) =>
        `<figure><img src="icons/${esc(f)}" alt="" loading="lazy" width="120" height="120"><figcaption>${esc(names.get(f))}</figcaption></figure>`,
    )
    .join('\n')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'index.html'),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tag Candy icons</title>
<style>
body { margin: 0; padding: 24px 16px; background: #202b33; color: #f5f8fa; font: 15px/1.4 system-ui, sans-serif; }
h1 { font-size: 22px; margin: 0 0 4px; }
p { margin: 0 0 20px; color: #bfccd6; }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; }
figure { margin: 0; text-align: center; }
img { width: 120px; height: 120px; }
figcaption { font-size: 13px; color: #bfccd6; }
</style>
</head>
<body>
<h1>Tag Candy icons</h1>
<p>Every icon Tag Candy gives tags, on the background Stash shows them on. For adults 18 or older.</p>
<main>
${tiles}
</main>
</body>
</html>
`,
  )
}
