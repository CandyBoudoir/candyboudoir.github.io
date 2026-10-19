// Screenshots of the page with its demo, in Stash's own look and under each
// CandyBoudoir theme, compared with baselines taken on the first Stash
// version in tests/stash-versions.json. Baselines come from the Linux CI
// runner, so these run in CI only unless VISUAL=1. The last check's time
// and the release dates, which the mock ThePornDB counts back from today,
// are masked.
import { expect, test } from '@playwright/test'
import { listPlugins } from '../../../scripts/site.mjs'
import {
  CHECK,
  PLUGIN_ID,
  openFilled,
  runTask,
  setUpNewReleases,
  settle,
  tearDownNewReleases,
  usePlugins,
} from './stash.mjs'

test.skip(
  !process.env.CI && !process.env.VISUAL,
  'Screenshot baselines come from Linux CI',
)
test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(120_000)
  await setUpNewReleases()
  await runTask(CHECK)
})
test.afterAll(async () => {
  test.setTimeout(120_000)
  await tearDownNewReleases()
})

const themes = (await listPlugins())
  .filter(({ mod }) => mod.kind === 'theme' && !mod.incubating)
  .map(({ name, mod }) => [name, mod.id])

const masks = (page) => [
  page.locator('.newreleases-status'),
  page.locator('.newreleases-card .scene-card__date'),
]

for (const [name, theme] of [['stash', null], ...themes]) {
  test(`the page looks the same in ${theme ?? "Stash's own look"}`, async ({
    page,
  }) => {
    await usePlugins(PLUGIN_ID, ...(theme ? [theme] : []))
    await openFilled(page)
    await page.mouse.move(0, 0)
    await settle(page)
    await expect(page).toHaveScreenshot(`page-${name}.png`, {
      mask: masks(page),
    })
  })
}

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  test('the page at phone width looks the same', async ({ page }) => {
    await usePlugins(PLUGIN_ID)
    await openFilled(page)
    await settle(page)
    await expect(page).toHaveScreenshot('phone.png', { mask: masks(page) })
  })
})
