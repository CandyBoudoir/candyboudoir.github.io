// Screenshots of the main pages, compared with baselines taken on the first
// Stash version in tests/stash-versions.json. Baselines come from the Linux CI
// runner, so these run in CI only unless VISUAL=1.
import { expect, test } from '@playwright/test'
import { EMPTY_LIST, FLOWS, PAGES, demoIds, visit } from './stash.mjs'

test.skip(
  !process.env.CI && !process.env.VISUAL,
  'Screenshot baselines come from Linux CI',
)

let ids
test.beforeAll(async () => {
  ids = await demoIds()
})
const url = (path) =>
  path
    .replace(':scene', ids.scene)
    .replace(':performer', ids.performer)
    .replace(':gallery', ids.gallery)

// Dates and versions that change from run to run.
const masks = (page) => [
  page.locator('h6', { hasText: /Created At|Updated At/ }),
  page.locator('.package-version, .package-date'),
]

// Waits for fonts and the images in view. Network idle never comes on the
// settings page, which keeps polling the plugin sources, and lazy images below
// the fold or inside a collapsed section (the Tagger's rows) never load.
async function settle(page) {
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

const SHOTS = [
  ...PAGES,
  ...FLOWS,
  ['empty', EMPTY_LIST, '.paginationIndex'],
  ['settings', '/settings?tab=plugins', '.setting-section'],
]

for (const entry of SHOTS) {
  const [name, path] = entry
  test(`${name} looks the same`, async ({ page }) => {
    const undo = await visit(page, url(path), entry)
    try {
      await settle(page)
      await expect(page).toHaveScreenshot(`${name}.png`, { mask: masks(page) })
    } finally {
      await undo?.()
    }
  })
}

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    // A touch screen, so Stash's (hover: none) and (pointer: coarse) rules apply.
    hasTouch: true,
  })
  for (const [name, card] of [
    ['scenes', '.scene-card'],
    ['images', '.image-card'],
  ]) {
    test(`${name} at phone width looks the same`, async ({ page }) => {
      await page.goto(`/${name}`)
      await page.locator(card).filter({ visible: true }).first().waitFor()
      await settle(page)
      await expect(page).toHaveScreenshot(`phone-${name}.png`)
    })
  }
})
