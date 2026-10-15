// Checks that Stash still renders the elements Juicy styles and that Juicy's
// CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  CHEEKY_EMPTY_LINE,
  EMPTY_LIST,
  FLOWS,
  PAGES,
  demoIds,
  demoPath,
  onlyJuicy,
  setPlugin,
  setSfw,
  unmatchedClasses,
  visit,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  await onlyJuicy()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

for (const entry of [...PAGES, ...FLOWS]) {
  const [name, path, , selectors] = entry
  test(`${name}: Stash renders the elements Juicy styles`, async ({ page }) => {
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

test('Juicy loads: class, colours, font and heart ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/\bjuicy\b/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    const star = document.querySelector('.rating-stars button svg')
    const style = star && getComputedStyle(star)
    return {
      background: getComputedStyle(document.body).backgroundColor,
      fredoka: document.fonts.check('600 16px "Juicy Fredoka"'),
      starMask: style ? style.maskImage || style.webkitMaskImage : '',
    }
  })
  expect(look.background).toBe('rgb(21, 10, 46)')
  expect(look.fredoka).toBe(true)
  expect(look.starMask).toContain('glyph-heart')
})

test('an empty list gets the cheeky line', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  await expect(page.locator('.paginationIndex')).toHaveAttribute(
    'data-juicy-empty',
    CHEEKY_EMPTY_LINE,
  )
})

// The zoom button on image cards is a small sticker in the picture's
// bottom-right corner. Stash draws it over the middle of the picture, where
// Juicy's candy pill rule once turned it into a big pink disc.
async function zoomSticker(page) {
  const card = page.locator('.image-card').first()
  const button = card.locator('.preview-button .btn')
  const preview = await card.locator('.image-card-preview').boundingBox()
  const box = await button.boundingBox()
  await expect(button).toHaveCSS('width', '36px')
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
  await zoomSticker(page)
  await button.click()
  await expect(page.locator('.Lightbox')).toBeVisible()
})

// Juicy's rating pill sits where Stash puts the card's checkbox, so it moves
// past the checkbox wherever both show.
async function ribbonClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const ribbon = await card.locator('.rating-banner').boundingBox()
  expect(ribbon.x).toBeGreaterThan(check.x + check.width)
}

test("a selected card's rating pill clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await card.locator('.card-check').check()
  await page.mouse.move(0, 0)
  await expect(card.locator('.rating-banner')).toHaveCSS('opacity', '1')
  await ribbonClearsCheckbox(card)
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
    const button = await zoomSticker(page)
    await expect(button).toHaveCSS('opacity', '1')
  })
  test('the rating pill clears the checkbox', async ({ page }) => {
    await page.goto('/scenes')
    const card = page.locator('.scene-card:has(.rating-banner)').first()
    await card.waitFor()
    await ribbonClearsCheckbox(card)
  })
})

test('Calm mode and Plain labels take effect', async ({ page }) => {
  try {
    await setPlugin({ calmMode: true, plainCopy: true })
    await page.goto(EMPTY_LIST)
    await expect(page.locator('html')).toHaveClass(/\bjuicy-calm\b/)
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-juicy-empty',
      '',
    )
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test('SFW mode drops the cheek', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-juicy-empty',
      '',
    )
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in juicy.css that no visited
// page or flow renders, and which of them still rendered on the baseline Stash
// version (plugins/juicy/tests/unmatched-baseline.txt). Those newly missing
// classes point at what a Stash change removed; the rest only appear in
// dialogs, menus or on hover.
test('report Stash classes Juicy styles that no page renders', async ({
  page,
}, info) => {
  const newlyMissing = await unmatchedClasses(page, {
    css: 'dist/site/Theme-Juicy/juicy.css',
    prefix: 'juicy',
    folder: 'juicy',
  })
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
