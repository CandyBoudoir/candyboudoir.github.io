// Helpers shared by the compatibility tests.
import { BOX_NAME } from '../../../tests/stash/stashbox-data.mjs'

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
// gallery, so detail pages show the parts Juicy styles.
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

export const setPlugin = (input) =>
  gql(
    'mutation ($i: Map!) { configurePlugin(plugin_id: "Theme-Juicy", input: $i) }',
    {
      i: input,
    },
  )

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

// Pages Juicy styles, the element to wait for, and the Stash elements Juicy
// depends on there. A missing element means Stash changed its markup.
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
export const CHEEKY_EMPTY_LINE = 'Nothing juicy here. Yet.'
