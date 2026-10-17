// Checks that Stash still renders the elements Overclock styles and that
// Overclock's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  VOICE_EMPTY_LINE,
  demoIds,
  demoPath,
  onlyOverclock,
  setPlugin,
  setSfw,
  unmatchedClasses,
  visit,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  await onlyOverclock()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

for (const entry of [...PAGES, ...FLOWS]) {
  const [name, path, , selectors] = entry
  test(`${name}: Stash renders the elements Overclock styles`, async ({
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

test('Overclock loads: class, colours, fonts and charge ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/\boverclock\b/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      background: getComputedStyle(document.body).backgroundColor,
      chakra: document.fonts.check('600 16px "Overclock Chakra"'),
      mono: document.fonts.check('400 16px "Overclock Mono"'),
    }
  })
  expect(look.background).toBe('rgb(10, 10, 12)')
  expect(look.chakra).toBe(true)
  expect(look.mono).toBe(true)
  expect(
    await maskOf(page.locator('.rating-stars .filled-star svg').first()),
  ).toContain('glyph-charge')
  expect(
    await maskOf(
      page
        .locator('.count-button .count-icon svg:not(.svg-inline--fa)')
        .first(),
    ),
  ).toContain('glyph-bolt')
})

test('the favourite is a reticle', async ({ page }) => {
  await page.goto(url('/performers/:performer'))
  const reticle = page.locator('.name-icons .favorite-button svg')
  await reticle.waitFor()
  expect(await maskOf(reticle)).toContain('glyph-reticle')
})

test('an empty list gets the system line', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  await expect(page.locator('.paginationIndex')).toHaveAttribute(
    'data-overclock-empty',
    VOICE_EMPTY_LINE,
  )
})

// Stash spaces the page, the filter sidebar and its sticky bars by its own
// navbar height. Overclock's bar has its own height, so it moves them and
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

// The zoom button on image cards is a small clipped square in the picture's
// bottom-right corner. Stash draws it as a big magnifier over the middle.
async function zoomCorner(page) {
  const card = page.locator('.image-card').first()
  const button = card.locator('.preview-button .btn')
  const preview = await card.locator('.image-card-preview').boundingBox()
  const box = await button.boundingBox()
  expect(box.width).toBeLessThan(48)
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
  await zoomCorner(page)
  await button.click()
  await expect(page.locator('.Lightbox')).toBeVisible()
})

// The rating tag sits to the right of the card's checkbox, so the checkbox is
// never covered.
async function tagClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const tag = await card.locator('.rating-banner').boundingBox()
  expect(tag.x).toBeGreaterThan(check.x + check.width)
}

test("a card's rating tag clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await tagClearsCheckbox(card)
  await card.locator('.card-check').check()
  await page.mouse.move(0, 0)
  await expect(card.locator('.rating-banner')).toHaveCSS('opacity', '1')
  await tagClearsCheckbox(card)
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
    const button = await zoomCorner(page)
    await expect(button).toHaveCSS('opacity', '1')
  })
  test('the rating tag clears the checkbox', async ({ page }) => {
    await page.goto('/scenes')
    const card = page.locator('.scene-card:has(.rating-banner)').first()
    await card.waitFor()
    await tagClearsCheckbox(card)
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
    await expect(page.locator('html')).toHaveClass(/\boverclock-calm\b/)
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-overclock-empty',
      '',
    )
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test('SFW mode drops the voice', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-overclock-empty',
      '',
    )
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in overclock.css that no
// visited page or flow renders, and which of them still rendered on the
// baseline Stash version (plugins/overclock/tests/unmatched-baseline.txt).
// Those newly missing classes point at what a Stash change removed; the rest
// only appear in dialogs, menus or on hover.
test('report Stash classes Overclock styles that no page renders', async ({
  page,
}, info) => {
  const newlyMissing = await unmatchedClasses(page, {
    css: 'dist/site/Theme-Overclock/overclock.css',
    prefix: 'overclock',
    folder: 'overclock',
  })
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
