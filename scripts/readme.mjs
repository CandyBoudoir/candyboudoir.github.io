// Writes the plugin table in README.md, between the plugins:start and
// plugins:end comments, from each plugin's plugin.mjs (`title` and `summary`),
// leaving out incubating plugins, so a new plugin edits only its own folder.
// A plugin from another repo (plugins.external.json) takes its title and
// summary from its entry there and links to its repo.
// The table follows the plugin folders' order, as the site's landing page
// does. `--check` writes nothing and fails when the table is out of date;
// `pnpm check` runs it that way.
// Usage: node scripts/readme.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import prettier from 'prettier'
import { listExternal } from './external.mjs'
import { listPlugins, root } from './site.mjs'

const file = join(root, 'README.md')
const START = '<!-- plugins:start -->'
const END = '<!-- plugins:end -->'

const cell = (s) => s.replaceAll('|', '\\|')
const rows = [
  ...(await listPlugins())
    .filter((p) => !p.mod.incubating)
    .map(({ name, mod }) => {
      if (!mod.summary)
        throw new Error(`plugins/${name}/plugin.mjs exports no summary`)
      return [name, mod.title, `plugins/${name}/`, mod.summary]
    }),
  ...(await listExternal()).map((p) => [
    p.folder,
    p.title,
    `https://github.com/${p.repo}`,
    p.summary,
  ]),
]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(
    ([, title, link, summary]) =>
      `| [${cell(title)}](${link}) | ${cell(summary)} |`,
  )
const table = ['| Plugin | What it does |', '| --- | --- |', ...rows].join('\n')

const current = await readFile(file, 'utf8')
const start = current.indexOf(START)
const end = current.indexOf(END)
if (start < 0 || end < start)
  throw new Error(`README.md has no ${START} ... ${END} block`)
const written = await prettier.format(
  `${current.slice(0, start + START.length)}\n\n${table}\n\n${current.slice(end)}`,
  { ...(await prettier.resolveConfig(file)), filepath: file },
)

if (process.argv.includes('--check')) {
  if (written !== current) {
    console.error(
      "README.md's plugin table is out of date: run node scripts/readme.mjs",
    )
    process.exit(1)
  }
} else if (written !== current) {
  await writeFile(file, written)
  console.log('Updated the plugin table in README.md')
}
