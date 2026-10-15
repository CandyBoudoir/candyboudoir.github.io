// Checks that Stash still renders the elements Leather styles and that
// Leather's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  STRICT_EMPTY_LINE,
  demoIds,
  demoPath,
  onlyLeather,
  setPlugin,
  setSfw,
  unmatchedClasses,
  visit,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  await onlyLeather()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

for (const entry of [...PAGES, ...FLOWS]) {
  const [name, path, , selectors] = entry
  test(`${name}: Stash renders the elements Leather styles`, async ({
    page,
  }) => {
    const undo = await visit(page, url(path), entry)
    try {
      for (const selector of selectors) {
        await expect
          .soft(page.locator(selector).first(), selector)
          .toBeAttached()
      }
    } finally {
      await undo?.()
    }
  })
}

// The mask each control paints through, read from its computed style.
const maskOf = (locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el)
    return style.maskImage || style.webkitMaskImage
  })

test('Leather loads: class, colours, fonts and stud ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/\bleather\b/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      background: getComputedStyle(document.body).backgroundColor,
      grenze: document.fonts.check('700 16px "Leather Grenze"'),
      oswald: document.fonts.check('500 16px "Leather Oswald"'),
    }
  })
  expect(look.background).toBe('rgb(12, 10, 11)')
  expect(look.grenze).toBe(true)
  expect(look.oswald).toBe(true)
  expect(
    await maskOf(page.locator('.rating-stars .filled-star svg').first()),
  ).toContain('glyph-stud')
  expect(
    await maskOf(
      page
        .locator('.count-button .count-icon svg:not(.svg-inline--fa)')
        .first(),
    ),
  ).toContain('glyph-flogger')
})

test('the favourite is a collar', async ({ page }) => {
  await page.goto(url('/performers/:performer'))
  const collar = page.locator('.name-icons .favorite-button svg')
  await collar.waitFor()
  expect(await maskOf(collar)).toContain('glyph-collar')
})

// The leather tiles come in one lossless file per screen density, chosen by
// image-set(), so a phone never shows an upscaled tile.
test.describe('on a 2x screen', () => {
  test.use({ deviceScaleFactor: 2 })
  test('the leather loads at the screen density', async ({ page }) => {
    await page.goto('/scenes')
    await page.locator('.scene-card').first().waitFor()
    await expect
      .poll(() =>
        page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((e) => e.name.split('/').pop())
            .filter((n) => n.startsWith('leather-')),
        ),
      )
      .toContain('leather-2x.webp')
  })
})

test('an empty list gets the strict line', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  await expect(page.locator('.paginationIndex')).toHaveAttribute(
    'data-leather-empty',
    STRICT_EMPTY_LINE,
  )
})

// Leather's navbar is taller than Stash's, and Stash spaces the page, the
// filter sidebar and its sticky bars by its own height. Leather moves them, so
// nothing starts under the bar.
async function clearsNavbar(page, selector) {
  const nav = await page.locator('.top-nav').boundingBox()
  const box = await page.locator(selector).first().boundingBox()
  expect(box.y, selector).toBeGreaterThanOrEqual(nav.y + nav.height - 1)
}

test('the page and the sidebar clear the navbar', async ({ page }) => {
  await page.goto('/scenes')
  await page.locator('.scene-card').first().waitFor()
  await clearsNavbar(page, '.filtered-list-toolbar')
  await page.locator('.sidebar-toggle-button').click()
  await expect(page.locator('.sidebar-pane:not(.hide-sidebar)')).toBeAttached()
  await clearsNavbar(page, '.sidebar')
})

// The zoom button on image cards is a nickel dome in the picture's
// bottom-right corner. Stash draws it as a big magnifier over the middle.
async function zoomDome(page) {
  const card = page.locator('.image-card').first()
  const button = card.locator('.preview-button .btn')
  const preview = await card.locator('.image-card-preview').boundingBox()
  const box = await button.boundingBox()
  await expect(button).toHaveCSS('width', '34px')
  expect(box.x).toBeGreaterThan(preview.x + preview.width / 2)
  expect(box.y).toBeGreaterThan(preview.y + preview.height / 2)
  return button
}

test('the image zoom button waits for hover in a corner', async ({ page }) => {
  await page.goto('/images')
  const card = page.locator('.image-card').first()
  await card.waitFor()
  await page.mouse.move(0, 0)
  const button = card.locator('.preview-button .btn')
  await expect(button).toHaveCSS('opacity', '0')
  await card.hover()
  await expect(button).toHaveCSS('opacity', '1')
  await expect(button).toHaveCSS('transform', 'none')
  await zoomDome(page)
  await button.click()
  await expect(page.locator('.Lightbox')).toBeVisible()
})

// Leather's rating tab hangs where Stash puts the card's checkbox, so it moves
// past the checkbox wherever both show.
async function tabClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const tab = await card.locator('.rating-banner').boundingBox()
  expect(tab.x).toBeGreaterThan(check.x + check.width)
}

test("a selected card's rating tab clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await card.locator('.card-check').check()
  await page.mouse.move(0, 0)
  await expect(card.locator('.rating-banner')).toHaveCSS('opacity', '1')
  await tabClearsCheckbox(card)
})

test.describe('on a touch screen', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  test('the image zoom button always shows in a corner', async ({ page }) => {
    await page.goto('/images')
    await page.locator('.image-card').first().waitFor()
    const button = await zoomDome(page)
    await expect(button).toHaveCSS('opacity', '1')
  })
  test('the rating tab clears the checkbox', async ({ page }) => {
    await page.goto('/scenes')
    const card = page.locator('.scene-card:has(.rating-banner)').first()
    await card.waitFor()
    await tabClearsCheckbox(card)
  })
  test('the navbar docks at the bottom with the page above it', async ({
    page,
  }) => {
    await page.goto('/scenes')
    await page.locator('.scene-card').first().waitFor()
    const nav = await page.locator('.top-nav').boundingBox()
    expect(nav.y + nav.height).toBeCloseTo(844, 0)
    const padding = await page.evaluate(
      () => getComputedStyle(document.body).paddingBottom,
    )
    expect(parseFloat(padding)).toBeGreaterThanOrEqual(nav.height - 1)
  })
})

test('Calm mode and Plain labels take effect', async ({ page }) => {
  try {
    await setPlugin({ calmMode: true, plainCopy: true })
    await page.goto(EMPTY_LIST)
    await expect(page.locator('html')).toHaveClass(/\bleather-calm\b/)
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-leather-empty',
      '',
    )
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test('SFW mode drops the voice and the collars', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-leather-empty',
      '',
    )
    await page.goto('/performers')
    const collar = page.locator('.performer-card .thumbnail-section').first()
    await collar.waitFor()
    expect(
      await collar.evaluate((el) => getComputedStyle(el, '::before').content),
    ).toBe('none')
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in leather.css that no
// visited page or flow renders, and which of them still rendered on the
// baseline Stash version (plugins/leather/tests/unmatched-baseline.txt). Those
// newly missing classes point at what a Stash change removed; the rest only
// appear in dialogs, menus or on hover.
test('report Stash classes Leather styles that no page renders', async ({
  page,
}, info) => {
  const newlyMissing = await unmatchedClasses(page, {
    css: 'dist/site/Theme-Leather/leather.css',
    prefix: 'leather',
    folder: 'leather',
  })
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
