// Helpers every plugin's compatibility tests share: the Stash API, the demo
// library's ids, the pages and stash-box flows the plugins style, and the
// switch that leaves one plugin enabled. A plugin's tests/stash.mjs adds its
// own on top.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { BOX_NAME } from './stashbox-data.mjs'
import { companionPluginIds } from './companions.mjs'

export const STASH = process.env.STASH_URL ?? 'http://127.0.0.1:9999'

export async function gql(query, variables = {}) {
  const res = await fetch(`${STASH}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

// Ids of a seeded scene with performers, a favourite performer and the demo
// gallery, so detail pages show the parts the plugins style.
export async function demoIds() {
  const { findScenes, findPerformers, findGalleries } = await gql(`{
    findScenes(filter: { per_page: 1, sort: "path" }) { scenes { id } }
    findPerformers(filter: { per_page: 1, sort: "name" },
      performer_filter: { filter_favorites: true }) { performers { id } }
    findGalleries(filter: { per_page: 1 }) { galleries { id } }
  }`)
  return {
    scene: findScenes.scenes[0].id,
    performer: findPerformers.performers[0].id,
    gallery: findGalleries.galleries[0].id,
  }
}

export const setPluginSettings = (id, input) =>
  gql(
    'mutation ($id: ID!, $i: Map!) { configurePlugin(plugin_id: $id, input: $i) }',
    {
      id,
      i: input,
    },
  )

// Enables the named plugins and disables every other installed plugin,
// except the companions (COMPANIONS, companions.mjs), which stay enabled
// beside them. prepare.mjs installs every plugin in the source into one
// Stash, and two themes enabled together would each see the other's CSS, so
// each plugin's spec files call this in a beforeAll. Stash loads a plugin's
// CSS and JavaScript when a page loads, so the next page.goto picks up the
// change.
export async function usePlugins(...ids) {
  const { plugins } = await gql('{ plugins { id } }')
  const on = [...ids, ...companionPluginIds()]
  for (const id of on)
    if (!plugins.some((p) => p.id === id))
      throw new Error(`${id} is not installed in this Stash`)
  await gql('mutation ($m: BoolMap!) { setPluginsEnabled(enabledMap: $m) }', {
    m: Object.fromEntries(plugins.map((p) => [p.id, on.includes(p.id)])),
  })
}

export const setAdvanced = (on) =>
  gql(
    'mutation ($on: Boolean) { configureUI(partial: { advancedMode: $on }) }',
    {
      on,
    },
  )

export const setSfw = (on) =>
  gql(
    'mutation ($on: Boolean) { configureInterface(input: { sfwContentMode: $on }) { sfwContentMode } }',
    {
      on,
    },
  )

// Pages the plugins style, the element to wait for, and the Stash elements
// the plugins depend on there. A missing element means Stash changed its
// markup.
export const PAGES = [
  [
    'scenes',
    '/scenes',
    '.scene-card',
    [
      '.top-nav',
      '.navbar-buttons',
      '.grid-card',
      '.scene-card',
      '.thumbnail-section',
      '.rating-banner',
      '.card-popovers',
      '.count-button',
      '.studio-overlay',
      '.paginationIndex',
      '.filtered-list-toolbar',
    ],
  ],
  [
    'scene',
    '/scenes/:scene',
    '.video-js',
    [
      '.rating-stars',
      '.tag-item',
      '.count-button',
      '.performer-card',
      '.vjs-control-bar',
      '.scrubber-tags-background',
      '.scrubber-button',
      '.scene-divider',
    ],
  ],
  [
    'performers',
    '/performers',
    '.performer-card',
    ['.performer-card', '.favorite-button', '.rating-banner'],
  ],
  [
    'performer',
    '/performers/:performer',
    '.detail-header',
    ['.detail-header', '.rating-stars', '.favorite-button', '.stash-id-pill'],
  ],
  [
    'images',
    '/images',
    '.image-card',
    ['.image-card', '.image-card-preview', '.preview-button', '.rating-banner'],
  ],
  [
    'gallery',
    '/galleries/:gallery',
    '.image-card',
    ['.image-card', '.preview-button', '.rating-banner'],
  ],
  ['studios', '/studios', '.studio-card', ['.studio-card']],
  ['tags', '/tags', '.tag-card', ['.tag-card']],
]

// Screens that need the mock stash-box (tests/stash/stashbox.mjs), in the same
// shape as PAGES plus `open`, which clicks through from the page to the state
// the selectors and screenshots check. `open` may return a function that puts
// back a setting it changed.
export const FLOWS = [
  [
    'tagger-scenes',
    '/scenes?disp=3',
    '.search-item',
    [
      '.tagger-container',
      '.search-item',
      '.scene-card-preview',
      '.search-result',
      '.selected-result',
      '.scene-image',
      '.optional-field',
      '.entity-name',
      '.performer-select-active',
      '.studio-select-active',
      '.stash-id-pill',
      '.text-success',
    ],
    async (page) => {
      const item = page.locator('.search-item').first()
      await item.locator('input.text-input').fill('Sweet Tooth')
      await item.getByRole('button', { name: 'Search', exact: true }).click()
      await page.locator('.selected-result').waitFor()
    },
  ],
  [
    'tagger-performers',
    '/performers?disp=3',
    '.PerformerTagger-performer',
    [
      '.PerformerTagger-performer',
      '.PerformerTagger-details',
      '.PerformerTagger-box-link',
      '.PerformerTagger-performer-search-item',
    ],
    async (page) => {
      await page
        .getByRole('button', { name: 'Search', exact: true })
        .first()
        .click()
      await page
        .locator('.PerformerTagger-performer-search-item')
        .first()
        .waitFor()
    },
  ],
  [
    'tagger-studios',
    '/studios?disp=3',
    '.StudioTagger-studio',
    ['.StudioTagger-studio', '.StudioTagger-details', '.StudioTagger-box-link'],
  ],
  [
    'tagger-tags',
    '/tags?disp=3',
    '.TagTagger-tag',
    ['.TagTagger-tag', '.TagTagger-details', '.TagTagger-box-link'],
  ],
  [
    'scene-scrape',
    '/scenes/:scene',
    '.video-js',
    [
      '.scrape-dialog',
      '.column-label',
      '.bg-secondary',
      '.border-secondary',
      '.input-group-prepend .text-success',
      '.string-list-input',
    ],
    async (page) => {
      await page.getByRole('tab', { name: 'Edit' }).click()
      await page.locator('.scraper-group .dropdown-toggle').first().click()
      await page.locator('.scraper-filter-container').waitFor()
      await page
        .locator('.dropdown-menu.show .dropdown-item', { hasText: BOX_NAME })
        .click()
      await page.locator('.scrape-dialog .modal-content').waitFor()
    },
  ],
  [
    'performer-scrape',
    '/performers/:performer',
    '.detail-header',
    ['.PerformerScrapeModal-list', '.search-item', '.performer-result'],
    async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.getByRole('button', { name: 'Scrape with…' }).first().click()
      await page
        .locator('.dropdown-menu.show .dropdown-item', { hasText: BOX_NAME })
        .click()
      await page
        .locator('.PerformerScrapeModal-list .search-item')
        .first()
        .waitFor()
    },
  ],
  [
    'identify',
    '/settings?tab=tasks',
    '.setting-section',
    ['.scraper-source-list', '.list-group-item', '.modal .table'],
    async (page) => {
      // Identify sits with the advanced settings.
      await setAdvanced(true)
      await page.reload()
      await page.locator('button', { hasText: 'Identify' }).first().click()
      await page.locator('.scraper-source-list').waitFor()
      return () => setAdvanced(false)
    },
  ],
  [
    'stash-box-endpoint',
    '/settings?tab=metadata-providers',
    '.setting-section',
    ['.stash-box-name', '.stash-box-endpoint', '.is-valid'],
    async (page) => {
      await page
        .locator('.setting', { hasText: BOX_NAME })
        .getByRole('button', { name: 'Edit' })
        .click()
      await page.locator('.modal .stash-box-endpoint').waitFor()
    },
  ],
]

// Opens a PAGES or FLOWS entry and returns the undo its `open` gave, if any.
// The pointer goes back to the corner so no hover state lingers from a click.
export async function visit(page, url, [, , ready, , open]) {
  await page.goto(url)
  await page.locator(ready).filter({ visible: true }).first().waitFor()
  const undo = await open?.(page)
  await page.mouse.move(0, 0)
  return undo
}

export const EMPTY_LIST = '/scenes?q=nothing-matches-this'

// Fills the demo ids into a PAGES or FLOWS path.
export const demoPath = (path, ids) =>
  path
    .replace(':scene', ids.scene)
    .replace(':performer', ids.performer)
    .replace(':gallery', ids.gallery)

// Dates and versions that change from run to run, masked in screenshots.
export const masks = (page) => [
  page.locator('h6', { hasText: /Created At|Updated At/ }),
  page.locator('.package-version, .package-date'),
]

// Waits for fonts and the images in view. Network idle never comes on the
// settings page, which keeps polling the plugin sources, and lazy images below
// the fold or inside a collapsed section (the Tagger's rows) never load.
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() =>
    [...document.images]
      .filter((img) => {
        const box = img.getBoundingClientRect()
        return box.width && box.height && box.top < window.innerHeight
      })
      .every((img) => img.complete),
  )
  await page.waitForTimeout(300)
}

// Settings › Plugins lists every installed plugin, so for its screenshot this
// hides the ones not enabled (usePlugins leaves the plugin under test) in the
// installed packages and in the plugin list, and shows the enabled ones'
// headings without their versions. Adding a plugin or releasing a version
// then changes no other plugin's baseline.
async function onlyEnabledPlugins(page) {
  // Longest name first, so a name that begins with another one finds its own
  const { plugins } = await gql('{ plugins { id name enabled } }')
  plugins.sort((a, b) => b.name.length - a.name.length)
  for (const { id, name } of plugins.filter((p) => p.enabled)) {
    await page
      .locator('.installed-packages .package-id', { hasText: id })
      .first()
      .waitFor()
    await page
      .locator('.setting-group > .setting h3', { hasText: name })
      .first()
      .waitFor()
  }
  await page.evaluate((plugins) => {
    for (const row of document.querySelectorAll('.installed-packages tr')) {
      const id = row.querySelector('.package-id')?.textContent
      if (id && !plugins.some((p) => p.enabled && p.id === id))
        row.style.display = 'none'
    }
    for (const h3 of document.querySelectorAll(
      '.setting-group > .setting h3',
    )) {
      const plugin = plugins.find((p) =>
        h3.textContent.startsWith(`${p.name} `),
      )
      if (!plugin) continue
      if (plugin.enabled) h3.textContent = plugin.name
      else h3.closest('.setting-group').style.display = 'none'
    }
  }, plugins)
}

// The screenshots every theme takes: each page and flow, an empty list and the
// plugin settings.
export const SHOTS = [
  ...PAGES,
  ...FLOWS,
  ['empty', EMPTY_LIST, '.paginationIndex'],
  [
    'settings',
    '/settings?tab=plugins',
    '.setting-section',
    [],
    onlyEnabledPlugins,
  ],
]

// The class names a built stylesheet's selectors name: those of its rules
// for the named restyled plugin (RESTYLED_CLASSES) with `plugin`, those of
// its rules for none of them without
async function stylesheetClasses(css, { plugin } = {}) {
  const source = (await readFile(css, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')
  const names = new Set()
  for (const [, selector] of source.matchAll(/([^{}]+)\{/g)) {
    const keep = plugin
      ? RESTYLED_CLASSES[plugin].rules.test(selector)
      : !Object.values(RESTYLED_CLASSES).some((r) => r.rules.test(selector))
    if (!keep) continue
    for (const m of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1])
  }
  return [...names]
}

// Compares the classes that matched nothing with the ones that matched
// nothing on the baseline (plugins/<folder>/tests/<name>-baseline.txt),
// writes both lists to pw-results/<folder>-*.txt for status.mjs and the
// report artifact (Playwright empties test-results/ at the start of each
// run, so the screenshot step would delete them there) and returns the
// newly missing ones.
async function newlyMissing(unmatched, folder, name) {
  const baseline = (
    await readFile(
      `plugins/${folder}/tests/${name}-baseline.txt`,
      'utf8',
    ).catch(() => '')
  )
    .split('\n')
    .filter(Boolean)
  const missing = baseline.length
    ? unmatched.filter((c) => !baseline.includes(c))
    : []
  const stem = name.replace(/-?unmatched$/, '')
  const file = `pw-results/${folder}${stem ? `-${stem}` : ''}`
  await mkdir('pw-results', { recursive: true })
  await writeFile(`${file}-unmatched-classes.txt`, unmatched.join('\n') + '\n')
  await writeFile(`${file}-newly-missing-classes.txt`, missing.join('\n'))
  return missing
}

// Lists the Stash classes in a built stylesheet that no visited page or flow
// renders, and which of them still rendered on the baseline Stash version
// (the plugin's tests/unmatched-baseline.txt). Those newly missing classes
// point at what a Stash change removed; the rest only appear in dialogs,
// menus or on hover. Rules for the restyled plugins are left to
// unmatchedRestyledClasses. Returns the newly missing ones.
export async function unmatchedClasses(page, { css, prefix, folder }) {
  const classes = (await stylesheetClasses(css)).filter(
    (c) => !c.startsWith(prefix),
  )
  const ids = await demoIds()
  const seen = new Set()
  for (const entry of [
    ...PAGES,
    ...FLOWS,
    ['empty', EMPTY_LIST, '.paginationIndex'],
  ]) {
    const undo = await visit(page, demoPath(entry[1], ids), entry)
    try {
      for (const c of await page.evaluate(
        (list) => list.filter((c) => document.getElementsByClassName(c).length),
        classes,
      )) {
        seen.add(c)
      }
    } finally {
      await undo?.()
    }
  }
  return newlyMissing(
    classes.filter((c) => !seen.has(c)).sort(),
    folder,
    'unmatched',
  )
}

// The plugins the themes restyle (RESTYLED in companions.mjs). A theme's
// specs switch one on with usePlugins, open it with these and check that the
// classes it styles still render with unmatchedRestyledClasses.

// Insights draws its dashboard on the Stats page, one tab at a time.
export const INSIGHTS_TABS = [
  'you',
  'actions',
  'library',
  'files',
  'health',
  'collection',
]

// Opens Insights on the Stats page, on the named tab, once it has read the
// library. Insights reads all of it on a first visit, which a fresh browser
// context always is.
export async function openInsights(page, tab = 'you') {
  await page.goto('/stats')
  const root = page.locator('#insights')
  await root.locator('.ins-tabs').waitFor({ timeout: 60_000 })
  await root
    .locator('.ins-progress')
    .waitFor({ state: 'detached', timeout: 60_000 })
  await root.locator(`.ins-tab[data-tab="${tab}"]`).click()
  await page.locator(`#insights[data-tab="${tab}"]`).waitFor()
  await root.locator('.ins-upd:not(.busy)').waitFor({ timeout: 30_000 })
}

// Performers Toolkit has its own page at /performerstoolkit, in tabs, a
// button on the Performers list, and on each performer's page a strip under
// the name and Stats and Catalog tabs. Its Catalog asks the stash-boxes from
// its Python backend, so the tour leaves it out.
export const PERFORMERS_TOOLKIT_TABS = [
  'find',
  'performers',
  'history',
  'sources',
]

// Opens the toolkit page on the named tab, once it has read the library
export async function openPerformersToolkit(page, tab = 'find') {
  await page.goto('/performerstoolkit')
  const root = page.locator('.pt.pt-page, .pt').first()
  await root.locator('.pt-tabs').waitFor({ timeout: 60_000 })
  await page.locator('.pt .pt-load').waitFor({ state: 'detached' })
  await root.locator(`.pt-tab[data-tab="${tab}"]`).click()
  await page.locator(`.pt[data-tab="${tab}"]`).waitFor()
  await page.locator('.pt .pt-load').waitFor({ state: 'detached' })
}

// Opens a performer's page on Performers Toolkit's Stats tab
export async function openPerformerStats(page, performer) {
  await page.goto(`/performers/${performer}`)
  await page.locator('#pt-strip').waitFor({ timeout: 30_000 })
  await page.locator('.pt-tablink[data-pt-tab="stats"]').click()
  await page.locator('.ptc .pt-stats3').waitFor({ timeout: 30_000 })
}

// How each restyled plugin's rules and classes are told apart in a theme's
// stylesheet, and the tour that renders as many of its classes as the demo
// library can
export const RESTYLED_CLASSES = {
  insights: {
    rules: /#ins(ights|-tip)\b|\.ins-/,
    names: /^ins-/,
    async tour(page, visit) {
      await openInsights(page, INSIGHTS_TABS[0])
      for (const tab of INSIGHTS_TABS) {
        await page.locator(`#insights .ins-tab[data-tab="${tab}"]`).click()
        await page.locator(`#insights[data-tab="${tab}"]`).waitFor()
        await visit()
      }
    },
  },
  performerstoolkit: {
    rules: /\.ptc?\b|#pt-/,
    names: /^ptc?$|^pt-/,
    async tour(page, visit) {
      for (const tab of PERFORMERS_TOOLKIT_TABS) {
        await openPerformersToolkit(page, tab)
        await visit()
      }
      await page.goto('/performers')
      await page.locator('.pt-entry').waitFor({ timeout: 30_000 })
      await visit()
      await openPerformerStats(page, (await demoIds()).performer)
      await visit()
      // The Stats tab folds its later sections; open each in turn
      const sections = page.locator('.ptc .pt-s3')
      for (let i = 0; i < (await sections.count()); i++) {
        const section = sections.nth(i)
        if (!(await section.evaluate((el) => el.matches('.pt-fold')))) continue
        await section.locator('.pt-s3h').click()
        await section.locator('.pt-s3b').waitFor()
        await visit()
      }
      // The strip's Picture button opens the pictures overlay
      await page.locator('#pt-strip .pt-pb', { hasText: 'Picture' }).click()
      await page.locator('.pt-ov').waitFor()
      await visit()
      await page.keyboard.press('Escape')
    },
  },
}

// Lists the classes of a restyled plugin (RESTYLED_CLASSES) in a theme's
// built stylesheet that its tour never renders on the demo library, and which
// of them rendered on the pinned release before (the theme's
// tests/<plugin>-unmatched-baseline.txt). The pin only moves with a new
// release of the plugin, so a newly missing class is one that release
// renamed or removed. Returns the newly missing ones.
export async function unmatchedRestyledClasses(page, { css, folder, plugin }) {
  const { names, tour } = RESTYLED_CLASSES[plugin]
  const classes = (await stylesheetClasses(css, { plugin })).filter((c) =>
    names.test(c),
  )
  const seen = new Set()
  await tour(page, async () => {
    for (const c of await page.evaluate(
      (list) => list.filter((c) => document.getElementsByClassName(c).length),
      classes,
    )) {
      seen.add(c)
    }
  })
  return newlyMissing(
    classes.filter((c) => !seen.has(c)).sort(),
    folder,
    `${plugin}-unmatched`,
  )
}

// The colour the page shows at a point, in CSS pixels, read off a
// screenshot: what lies behind an icon when a theme paints its button with
// a gradient, which no computed style gives.
export async function colorAt(page, x, y) {
  const png = await page.screenshot({
    clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 },
  })
  return page.evaluate(
    async (src) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return `rgb(${r}, ${g}, ${b})`
    },
    `data:image/png;base64,${png.toString('base64')}`,
  )
}
