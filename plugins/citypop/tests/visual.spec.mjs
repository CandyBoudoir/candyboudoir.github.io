// Screenshots of the main pages, compared with baselines taken on the first
// Stash version in tests/stash-versions.json. Baselines come from the Linux CI
// runner, so these run in CI only unless VISUAL=1.
import { expect, test } from '@playwright/test'
import {
  SHOTS,
  demoIds,
  demoPath,
  PLUGIN_ID,
  masks,
  onlyCityPop,
  openInsights,
  setPlugin,
  settle,
  usePlugins,
  visit,
} from './stash.mjs'

test.skip(
  !process.env.CI && !process.env.VISUAL,
  'Screenshot baselines come from Linux CI',
)

let ids
test.beforeAll(async () => {
  await onlyCityPop()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

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

// Insights in the dusk, with Restyle Insights and Performers Toolkit on. Its Library and Files tabs
// only; the others count from today (O's this week, growth by month), so
// their pictures would change by the day.
test.describe('Insights', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'Insights')
    await setPlugin({ restylePlugins: true })
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyCityPop()
  })
  for (const tab of ['library', 'files']) {
    test(`Insights' ${tab} tab looks the same`, async ({ page }) => {
      await openInsights(page, tab)
      await settle(page)
      await expect(page).toHaveScreenshot(`insights-${tab}.png`, {
        mask: [
          page.locator('#insights .ins-meta'),
          page
            .locator('#insights .ins-nb')
            .filter({ hasText: 'Newest addition' }),
        ],
      })
    })
  }
})

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

  // Stash docks the bar at the bottom of an upright phone and folds the page
  // links behind its menu button.
  test('the folded menu at phone width looks the same', async ({ page }) => {
    await page.goto('/scenes')
    await page
      .locator('.scene-card')
      .filter({ visible: true })
      .first()
      .waitFor()
    await page.locator('.top-nav .navbar-toggler').click()
    await page.locator('.top-nav .navbar-collapse.show').waitFor()
    await settle(page)
    await expect(page).toHaveScreenshot('phone-menu.png')
  })
})
