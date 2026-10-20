// New Releases under each CandyBoudoir theme. The page draws with Stash's
// own components and classes, so a theme restyles it: these check that the
// loader is the theme's loader for Stash, that the cards' titles and
// descriptions, the sort menu and the pagination look as they do on Stash's
// scene list under the same theme, that Just in's heading looks like the
// front page's rows', and that the New badge reads over a cover, with no
// page error.
import { expect, test } from '@playwright/test'
import { listPlugins } from '../../../scripts/site.mjs'
import {
  CHECK,
  PLUGIN_ID,
  ROUTE,
  TPDB_SITES,
  ageCatalog,
  arriveWhileOpen,
  lateRelease,
  publishLate,
  runTask,
  setUpNewReleases,
  tearDownNewReleases,
  usePlugins,
  withdrawLate,
} from './stash.mjs'

test.describe.configure({ mode: 'serial' })

// A day after the first check, a second finds each site's late release
test.beforeAll(async () => {
  test.setTimeout(120_000)
  await setUpNewReleases()
  await runTask(CHECK)
  await ageCatalog(21)
  await publishLate(TPDB_SITES.lollipop)
  await publishLate(TPDB_SITES.gumball)
  await runTask(CHECK)
  await withdrawLate()
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

const PAGE_BUTTON =
  '.pagination-index-container .pagination .btn:not(:disabled):not(.active)'

for (const theme of themes) {
  test(`with ${theme}: the page takes the theme’s loader, cards, sort menu, rows, badges and pagination`, async ({
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
      sortToggle: await page
        .locator('.filtered-list-toolbar .sort-by-select .dropdown-toggle')
        .evaluate(look),
    }
    await page.unroute('**/graphql')
    // A row's heading on Stash's front page
    await page.goto('/')
    const rowHeading = page.locator('.recommendation-row-head h2').first()
    await rowHeading.waitFor()
    stash.rowHeading = await rowHeading.evaluate(look)

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
    expect(
      await page
        .locator('.filtered-list-toolbar .sort-by-select .dropdown-toggle')
        .evaluate(look),
    ).toEqual(stash.sortToggle)
    await page.unroute('**/assets/catalog/catalog.json')

    // A release arriving while the page is open: Just in's heading is the
    // front page's, and New reads over the cover, on hover too
    await arriveWhileOpen(page, lateRelease(TPDB_SITES.gumball))
    await page.goto(ROUTE)
    const heading = page.locator(
      '.newreleases-just-in .recommendation-row-head h2',
    )
    await expect(heading).toHaveText('Just in', { timeout: 30_000 })
    expect(await heading.evaluate(look)).toEqual(stash.rowHeading)
    const newCard = page
      .locator('.newreleases-grid .newreleases-card', {
        has: page.locator('.newreleases-new-badge'),
      })
      .first()
    const badge = newCard.locator('.newreleases-new-badge .badge')
    await expect(badge).toHaveText('New')
    await page.mouse.move(0, 0)
    expect(await badge.evaluate(contrastOverCover)).toBeGreaterThanOrEqual(4.5)
    await newCard.hover()
    await expect(badge).toHaveCSS('opacity', '1')
    await expect(badge).toBeVisible()
    expect(errors).toEqual([])
  })
}
