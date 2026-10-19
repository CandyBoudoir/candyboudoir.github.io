// New Releases under each CandyBoudoir theme. The page draws with Stash's
// own components and classes, so a theme restyles it: these check that the
// loader is the theme's loader for Stash, the cards take the theme's scene
// cards, "In your library" reads over any cover, and no page error shows.
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

// The lowest WCAG contrast between an element's text and the opaque colours
// behind it: its background colour and every colour of its gradients. 0
// when nothing behind it is opaque, since the cover would show through.
const contrastOverCover = (el) => {
  const rgb = (s) => s.match(/[\d.]+/g).map(Number)
  const luminance = ([r, g, b]) => {
    const lin = (c) =>
      c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const style = getComputedStyle(el)
  const opaque = [
    style.backgroundColor,
    ...(style.backgroundImage.match(/rgba?\([^)]*\)/g) || []),
  ]
    .map(rgb)
    .filter((c) => (c[3] ?? 1) === 1)
  if (!opaque.length) return 0
  const text = rgb(style.color)
  return Math.min(...opaque.map((c) => ratio(text, c)))
}

for (const theme of themes) {
  test(`with ${theme}: the page takes the theme’s loader, cards and badges`, async ({
    page,
  }) => {
    await usePlugins(PLUGIN_ID, theme)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    // Stash's own loader under the theme, on a list held back
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
    await page.goto('/scenes')
    await expect.poll(() => holding, { timeout: 15_000 }).toBe(true)
    const stashLoader = page
      .locator('.LoadingIndicator .spinner-border')
      .filter({ visible: true })
      .first()
    await expect(stashLoader).toBeVisible({ timeout: 15_000 })
    const stashLook = await stashLoader.evaluate(loaderLook)
    releaseList()
    const stashTitle = await page
      .locator('.scene-card .card-section-title')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    await page.unroute('**/graphql')

    // The page's, while its catalog is held back
    let releaseCatalog
    const catalogHeld = new Promise((r) => (releaseCatalog = r))
    await page.route('**/assets/catalog/catalog.json', async (route) => {
      await catalogHeld
      await route.continue()
    })
    await page.goto(ROUTE)
    const loader = page.locator(
      '.newreleases-page .LoadingIndicator .spinner-border',
    )
    await expect(loader).toBeVisible({ timeout: 15_000 })
    expect(await loader.evaluate(loaderLook)).toEqual(stashLook)
    releaseCatalog()

    const card = page.locator('.newreleases-card').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    // Its cards are the theme's scene cards
    expect(
      await card
        .locator('.card-section-title')
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).toBe(stashTitle)

    // "In your library" reads over any cover, hovered or not
    const owned = page.locator('.newreleases-owned').first()
    const badge = owned.locator('.newreleases-owned-badge .badge')
    await expect(badge).toBeVisible()
    expect(await badge.evaluate(contrastOverCover)).toBeGreaterThanOrEqual(4.5)
    await owned.hover()
    await expect(badge).toHaveCSS('opacity', '1')
    await expect(badge).toBeVisible()
    expect(errors).toEqual([])
  })
}
