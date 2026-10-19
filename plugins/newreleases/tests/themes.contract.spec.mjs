// New Releases under each CandyBoudoir theme. The page draws with Stash's
// own components and classes, so a theme restyles it: these check that the
// loader is the theme's loader for Stash, and that the cards' titles and
// descriptions and the pagination look as they do on Stash's scene list
// under the same theme, with no page error.
import { expect, test } from '@playwright/test'
import { listPlugins } from '../../../scripts/site.mjs'
import {
  CHECK,
  PLUGIN_ID,
  ROUTE,
  runTask,
  setUpNewReleases,
  tearDownNewReleases,
  usePlugins,
} from './stash.mjs'

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

// Every CandyBoudoir theme (`kind = 'theme'` in its plugin.mjs) except the
// incubating ones
const themes = (await listPlugins())
  .filter(({ mod }) => mod.kind === 'theme' && !mod.incubating)
  .map(({ mod }) => mod.id)

// What makes a loader look like itself
const loaderLook = (el) => {
  const s = getComputedStyle(el)
  return {
    animation: s.animationName,
    background: s.backgroundImage,
    border: `${s.borderTopStyle} ${s.borderTopColor}`,
  }
}

// How a piece of text or a button looks, as far as a theme decides it
const look = (el) => {
  const s = getComputedStyle(el)
  return {
    font: s.fontFamily,
    color: s.color,
    background: `${s.backgroundColor} ${s.backgroundImage}`,
  }
}

const PAGE_BUTTON =
  '.pagination-index-container .pagination .btn:not(:disabled):not(.active)'

for (const theme of themes) {
  test(`with ${theme}: the page takes the theme’s loader, cards and pagination`, async ({
    page,
  }) => {
    await usePlugins(PLUGIN_ID, theme)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    // Stash's own loader under the theme, on a list held back, then the
    // list itself, two scenes a page so it shows its pagination
    let releaseList
    let holding = false
    const listHeld = new Promise((r) => (releaseList = r))
    await page.route('**/graphql', async (route) => {
      if (/FindScenes/.test(route.request().postData() || '')) {
        holding = true
        await listHeld
      }
      await route.continue()
    })
    await page.goto('/scenes?perPage=2')
    await expect.poll(() => holding, { timeout: 15_000 }).toBe(true)
    const stashLoader = page
      .locator('.LoadingIndicator .spinner-border')
      .filter({ visible: true })
      .first()
    await expect(stashLoader).toBeVisible({ timeout: 15_000 })
    const stashLook = await stashLoader.evaluate(loaderLook)
    releaseList()
    const stashCard = page.locator('.scene-card').first()
    await stashCard.waitFor()
    await page.mouse.move(0, 0)
    const stash = {
      title: await stashCard.locator('.card-section-title').evaluate(look),
      description: await stashCard
        .locator('.scene-card__description')
        .evaluate(look),
      pageButton: await page.locator(PAGE_BUTTON).first().evaluate(look),
    }
    await page.unroute('**/graphql')

    // The page's loader, while its catalog is held back
    let releaseCatalog
    const catalogHeld = new Promise((r) => (releaseCatalog = r))
    await page.route('**/assets/catalog/catalog.json', async (route) => {
      await catalogHeld
      await route.continue()
    })
    await page.goto(`${ROUTE}?perPage=2`)
    const loader = page.locator(
      '.newreleases-page .LoadingIndicator .spinner-border',
    )
    await expect(loader).toBeVisible({ timeout: 15_000 })
    expect(await loader.evaluate(loaderLook)).toEqual(stashLook)
    releaseCatalog()

    // Its cards and pagination are the theme's, as on Stash's scene list
    const card = page.locator('.newreleases-card').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    await page.mouse.move(0, 0)
    expect(await card.locator('.card-section-title').evaluate(look)).toEqual(
      stash.title,
    )
    expect(
      await card.locator('.scene-card__description').evaluate(look),
    ).toEqual(stash.description)
    expect(await page.locator(PAGE_BUTTON).first().evaluate(look)).toEqual(
      stash.pageButton,
    )
    expect(errors).toEqual([])
  })
}
