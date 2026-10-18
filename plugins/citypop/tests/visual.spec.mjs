// Screenshots of the main pages, compared with baselines taken on the first
// Stash version in tests/stash-versions.json. Baselines come from the Linux CI
// runner, so these run in CI only unless VISUAL=1.
import { expect, test } from '@playwright/test'
import {
  SHOTS,
  demoIds,
  demoPath,
  masks,
  onlyCityPop,
  settle,
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
