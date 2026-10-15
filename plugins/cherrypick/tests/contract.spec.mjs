// Checks that Cherry Pick's pieces render in Stash's pages, on the seams
// docs/stash-seams.md lists, and that what it stores reaches Stash.
import { expect, test } from '@playwright/test'
import {
  demoIds,
  demoScene,
  forYouCards,
  pluginConfig,
  setUpCherryPick,
  tearDownCherryPick,
} from './stash.mjs'

let shared
let demo
test.beforeAll(async () => {
  // The shared library's ids, before the demo library adds its own.
  shared = await demoIds()
  demo = await setUpCherryPick()
})
test.afterAll(tearDownCherryPick)

test('For you comes first on the front page, before Stash rows', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  expect(await forYouCards(page).count()).toBe(12)
  // Every card says why it is there, in place of its description.
  await expect(
    page.locator('.cherrypick-for-you .cherrypick-reason').first(),
  ).not.toBeEmpty()
  // Stash's own rows and Customise button are still there, after Cherry Pick's.
  const order = await page.evaluate(() => {
    const ours = document.querySelector('.cherrypick-front')
    const stash = document.querySelector(
      '.recommendations-container:not(.cherrypick-front)',
    )
    return {
      before: !!(
        ours &&
        stash &&
        ours.compareDocumentPosition(stash) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      customise: !!stash?.querySelector('.recommendations-footer .btn'),
    }
  })
  expect(order).toEqual({ before: true, customise: true })
  expect(errors).toEqual([])
})

test('Not interested hides a card in place and is saved to Stash', async ({
  page,
}) => {
  await page.goto('/')
  const card = forYouCards(page).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  const slide = page.locator(
    '.cherrypick-for-you .slick-active:not(.slick-cloned)',
  )
  await slide.first().locator('.cherrypick-card-menu button').click()
  await slide.first().locator('.cherrypick-ni').click()
  // Slick clones slides for its infinite scroll; act on the real ones.
  const hidden = page.locator(
    '.cherrypick-for-you .slick-slide:not(.slick-cloned) .cherrypick-hidden-card',
  )
  await expect(hidden.first()).toBeVisible()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.notInterested || '[]'))
    .toHaveLength(1)
  await hidden.first().locator('.btn').click()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.notInterested || '[]'))
    .toHaveLength(0)
})

test('Your score shows on unrated scene cards only', async ({ page }) => {
  const unrated = demoScene(demo, { rated: false, played: true })
  const rated = demoScene(demo, { rated: true, played: true })
  await page.goto('/scenes?sortby=title&perPage=120')
  await expect(page.locator('.cherrypick-score-banner').first()).toBeVisible({
    timeout: 20_000,
  })
  const banner = (id) =>
    page.locator(
      `.scene-card:has(a[href^="/scenes/${id}"]) .cherrypick-score-banner`,
    )
  await expect(banner(unrated)).toHaveCount(1)
  await expect(banner(unrated)).toHaveText(/^~\d\.\d/)
  await expect(banner(rated)).toHaveCount(0)
})

test("the scene page shows the score line, Don't learn and More like this", async ({
  page,
}) => {
  const unrated = demoScene(demo, { rated: false, played: true })
  await page.goto(`/scenes/${unrated}`)
  const line = page.locator('.scene-toolbar .cherrypick-score-line')
  await expect(line.locator('.cherrypick-line-button').first()).toHaveText(
    /^likely .* for you$/,
    { timeout: 20_000 },
  )
  await expect(
    page.locator('.cherrypick-more-like-this h2', {
      hasText: 'More like this',
    }),
  ).toBeAttached()
  // Without a StashDB key, the second row is the connect line.
  await expect(page.locator('.cherrypick-connect-line')).toBeAttached()

  await line.locator('.cherrypick-dont-learn').click()
  await expect(line.locator('.cherrypick-dont-learn')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.dontLearn || '[]'))
    .toEqual([expect.objectContaining({ sceneId: unrated })])
  await line.locator('.cherrypick-dont-learn').click()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.dontLearn || '[]'))
    .toEqual([])
})

test('nothing of Cherry Pick shows once the scene plays', async ({ page }) => {
  // A shared clip, so there is a player. A play event is enough: the clip
  // need not run, and its play count stays as the themes' screenshots expect.
  await page.goto(`/scenes/${shared.scene}`)
  const ui = page.locator('.cherrypick-more-like-this')
  await expect(ui).toBeAttached({ timeout: 20_000 })
  await page
    .locator('.scene-player-container video')
    .first()
    .evaluate((v) => v.dispatchEvent(new Event('play')))
  await expect(page.locator('body')).toHaveClass(/cherrypick-watching/)
  await expect(ui).toBeHidden()
  await expect(page.locator('.cherrypick-nav-icon').first()).toBeHidden()
})

test('the navbar cherries open the plugin page, which survives a reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.cherrypick-nav-icon').filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/plugins\/cherrypick$/)
  await expect(page.locator('.cherrypick-page h1').first()).toContainText(
    'Cherry Pick',
  )
  await page.reload()
  await expect(page.locator('#your-score')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#your-score')).toContainText(
    /within half a star \d+ times in 10/,
  )
})

test('Settings › Plugins lists the switches, already on', async ({ page }) => {
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  // Cherry Pick wrote its defaults at first load.
  await expect.poll(async () => (await pluginConfig())?.showForYou).toBe(true)
  await page.goto('/settings?tab=plugins')
  // Stash gives each setting's switch the id plugin-<plugin>-<setting>.
  const toggle = page.locator('#plugin-CherryPick-showForYou')
  await expect(toggle).toBeAttached({ timeout: 20_000 })
  await expect(toggle).toBeChecked()
})

test('switching For you off removes the row', async ({ page }) => {
  await page.goto('/settings?tab=plugins')
  const toggle = page.locator('#plugin-CherryPick-showForYou')
  await toggle.waitFor()
  await toggle.click({ force: true })
  await expect.poll(async () => (await pluginConfig())?.showForYou).toBe(false)
  await page.goto('/')
  await page.locator('.recommendations-container').first().waitFor()
  await page.waitForTimeout(3000)
  await expect(page.locator('.cherrypick-for-you')).toHaveCount(0)
  await page.goto('/settings?tab=plugins')
  await toggle.waitFor()
  await toggle.click({ force: true })
  await expect.poll(async () => (await pluginConfig())?.showForYou).toBe(true)
})

test('Remove Cherry Pick data leaves a tombstone', async ({ page }) => {
  await page.goto('/plugins/cherrypick')
  await page.locator('#remove .btn-danger').click()
  const dialog = page.locator('.modal-dialog')
  await expect(dialog).toContainText('Remove Cherry Pick data?')
  await dialog.locator('.btn-danger').click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await pluginConfig())?.removedAt).toBeTruthy()
})
