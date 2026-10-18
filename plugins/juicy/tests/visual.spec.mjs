// Screenshots of the main pages, compared with baselines taken on the first
// Stash version in tests/stash-versions.json. Baselines come from the Linux CI
// runner, so these run in CI only unless VISUAL=1.
import { expect, test } from '@playwright/test'
import {
  PLUGIN_ID,
  SHOTS,
  demoIds,
  demoPath,
  masks,
  onlyJuicy,
  openInsights,
  openPerformerStats,
  openPerformersToolkit,
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
  await onlyJuicy()
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

// Insights in the candy, with Restyle Insights on. Its Library and Files
// tabs only; the others count from today (O's this week, growth by month), so
// their pictures would change by the day.
test.describe('Insights', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'Insights')
    await setPlugin({ restyleInsights: true })
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyJuicy()
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

// Performers Toolkit in the candy, with Restyle Performers Toolkit on: its
// page, and a performer's page open on its Stats tab (whose charts count back
// from today, so they are masked)
test.describe('Performers Toolkit', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
    await setPlugin({ restylePerformersToolkit: true })
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyJuicy()
  })

  test("Performers Toolkit's page looks the same", async ({ page }) => {
    await openPerformersToolkit(page, 'find')
    await settle(page)
    await expect(page).toHaveScreenshot('performers-toolkit.png', {
      mask: [page.locator('.pt-read')],
    })
  })

  test("a performer's Stats tab looks the same", async ({ page }) => {
    await openPerformerStats(page, ids.performer)
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await expect(page).toHaveScreenshot('performer-stats.png', {
      mask: [page.locator('.ptc .pt-bars')],
    })
  })
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
})
