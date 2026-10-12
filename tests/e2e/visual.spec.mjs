// Screenshots of the main pages, compared with baselines taken on the first
// Stash version in tests/stash-versions.json. Baselines come from the Linux CI
// runner, so these run in CI only unless VISUAL=1.
import { expect, test } from '@playwright/test'
import { EMPTY_LIST, PAGES, demoIds } from './stash.mjs'

test.skip(
  !process.env.CI && !process.env.VISUAL,
  'Screenshot baselines come from Linux CI',
)

let ids
test.beforeAll(async () => {
  ids = await demoIds()
})
const url = (path) =>
  path.replace(':scene', ids.scene).replace(':performer', ids.performer)

// Dates and versions that change from run to run.
const masks = (page) => [
  page.locator('h6', { hasText: /Created At|Updated At/ }),
  page.locator('.package-version, .package-date'),
]

// Waits for fonts and the images in view. Network idle never comes on the
// settings page, which keeps polling the plugin sources, and lazy images below
// the fold never load.
async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() =>
    [...document.images]
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete),
  )
  await page.waitForTimeout(300)
}

const SHOTS = [
  ...PAGES.map(([name, path, ready]) => [name, path, ready]),
  ['empty', EMPTY_LIST, '.paginationIndex'],
  ['settings', '/settings?tab=plugins', '.setting-section'],
]

for (const [name, path, ready] of SHOTS) {
  test(`${name} looks the same`, async ({ page }) => {
    await page.goto(url(path))
    await page.locator(ready).filter({ visible: true }).first().waitFor()
    await settle(page)
    await expect(page).toHaveScreenshot(`${name}.png`, { mask: masks(page) })
  })
}

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  test('scenes at phone width looks the same', async ({ page }) => {
    await page.goto('/scenes')
    await page
      .locator('.scene-card')
      .filter({ visible: true })
      .first()
      .waitFor()
    await settle(page)
    await expect(page).toHaveScreenshot('phone-scenes.png')
  })
})
