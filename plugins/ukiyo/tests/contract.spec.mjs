// Checks that Stash still renders the elements Ukiyo styles and that Ukiyo's
// CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  VOICE_EMPTY_LINE,
  demoIds,
  demoPath,
  gql,
  onlyUkiyo,
  setPlugin,
  setSfw,
  unmatchedClasses,
  visit,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  await onlyUkiyo()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

for (const entry of [...PAGES, ...FLOWS]) {
  const [name, path, , selectors] = entry
  test(`${name}: Stash renders the elements Ukiyo styles`, async ({ page }) => {
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

// The mask and the background each control paints through, read from its
// computed style.
const maskOf = (locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el)
    return style.maskImage || style.webkitMaskImage
  })
const backgroundOf = (locator) =>
  locator.evaluate((el) => getComputedStyle(el).backgroundImage)

test('Ukiyo loads: class, colours, fonts and blossom ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/(^|\s)ukiyo(\s|$)/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      background: getComputedStyle(document.body).backgroundColor,
      mincho: document.fonts.check('700 16px "Ukiyo Mincho"'),
      gothic: document.fonts.check('500 16px "Ukiyo Gothic"'),
    }
  })
  expect(look.background).toBe('rgb(8, 13, 24)')
  expect(look.mincho).toBe(true)
  expect(look.gothic).toBe(true)
  expect(
    await backgroundOf(page.locator('.rating-stars .filled-star svg').first()),
  ).toContain('glyph-sakura.svg')
  expect(
    await maskOf(page.locator('.rating-stars .unfilled-star svg').first()),
  ).toContain('glyph-sakura-line')
  expect(
    await backgroundOf(
      page
        .locator('.count-button .count-icon svg:not(.svg-inline--fa)')
        .first(),
    ),
  ).toContain('glyph-wave')
})

test('the favourite is the red seal', async ({ page }) => {
  await page.goto(url('/performers/:performer'))
  const seal = page.locator('.name-icons .favorite-button.favorite svg')
  await seal.waitFor()
  expect(await backgroundOf(seal)).toContain('hanko.svg')
})

// The washi tile comes in one lossless file per screen density, chosen by
// image-set(), so a phone never shows an upscaled tile.
test.describe('on a 2x screen', () => {
  test.use({ deviceScaleFactor: 2 })
  test('the washi loads at the screen density', async ({ page }) => {
    await page.goto('/scenes')
    await page.locator('.scene-card').first().waitFor()
    await expect
      .poll(() =>
        page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((e) => e.name.split('/').pop())
            .filter((n) => n.startsWith('washi-')),
        ),
      )
      .toContain('washi-2x.webp')
  })
})

test('an empty list gets her line and the beauty print', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  const index = page.locator('.paginationIndex')
  await expect(index).toHaveAttribute('data-ukiyo-empty', VOICE_EMPTY_LINE)
  const print = await index.evaluate(
    (el) => getComputedStyle(el, '::before').backgroundImage,
  )
  expect(print).toContain('bijin.webp')
})

// Ukiyo's navbar is taller than Stash's, and Stash spaces the page, the
// filter sidebar and its sticky bars by its own height. Ukiyo moves them, so
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

// The detail header is a night print. Stash's own setting decides whether
// her blurred picture shows in it, as a faint tone in the sky.
test("the performer header follows Stash's background-image setting", async ({
  page,
}) => {
  const setBackground = (on) =>
    gql(
      'mutation ($on: Boolean) { configureUI(partial: { enablePerformerBackgroundImage: $on }) }',
      { on },
    )
  try {
    await setBackground(false)
    await page.goto(url('/performers/:performer'))
    const header = page.locator('.detail-header').first()
    await header.waitFor()
    expect(await backgroundOf(header)).toContain('moon.svg')
    await expect(header.locator('.background-image-container')).toHaveCount(0)

    await setBackground(true)
    await page.reload()
    const tone = page.locator('.detail-header .background-image-container')
    await expect(tone).toBeAttached()
    await expect(tone).toHaveCSS('opacity', '0.1')
    expect(await backgroundOf(page.locator('.detail-header'))).toContain(
      'moon.svg',
    )
  } finally {
    await setBackground(false)
  }
})

// The zoom button on image cards is a small vermilion seal in the picture's
// bottom-right corner. Stash draws it as a big magnifier over the middle.
async function zoomSeal(page) {
  const card = page.locator('.image-card').first()
  const button = card.locator('.preview-button .btn')
  const preview = await card.locator('.image-card-preview').boundingBox()
  const box = await button.boundingBox()
  await expect(button).toHaveCSS('width', '32px')
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
  await zoomSeal(page)
  await button.click()
  await expect(page.locator('.Lightbox')).toBeVisible()
})

// The rating slip hangs to the right of the card's checkbox, so the checkbox
// is never covered.
async function slipClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const slip = await card.locator('.rating-banner').boundingBox()
  expect(slip.x).toBeGreaterThan(check.x + check.width)
}

test("a card's rating slip clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await slipClearsCheckbox(card)
  await card.locator('.card-check').check()
  await page.mouse.move(0, 0)
  await expect(card.locator('.rating-banner')).toHaveCSS('opacity', '1')
  await slipClearsCheckbox(card)
})

// The Tagger is a work surface: its chosen row is printed out of register
// like every chosen thing, but nothing in it moves.
test('the Tagger stays still', async ({ page }) => {
  const entry = FLOWS.find(([name]) => name === 'tagger-scenes')
  const undo = await visit(page, url(entry[1]), entry)
  try {
    const chosen = page.locator('.selected-result').first()
    await expect(chosen).toHaveCSS('transform', 'none')
    await expect(chosen).toHaveCSS('transition-duration', '0s')
    expect(
      await chosen.evaluate((el) => getComputedStyle(el).boxShadow),
    ).toContain('5px 4px 0px 0px')
    const card = page.locator('.tagger-container .grid-card').first()
    if (await card.count()) {
      await card.hover()
      await expect(card).toHaveCSS('transform', 'none')
    }
  } finally {
    await undo?.()
  }
})

// Favouriting scatters petals and stamps the seal. The performer is put back
// as it was.
test('favouriting scatters petals and stamps the seal', async ({ page }) => {
  await page.goto('/performers')
  const unset = page
    .locator('.performer-card:has(.favorite-button.not-favorite)')
    .first()
  await unset.waitFor()
  // Held by name, since the card stops matching once it is a favourite
  const name = await unset.locator('.performer-name').first().innerText()
  const card = page.locator('.performer-card', {
    has: page.locator('.performer-name', { hasText: name }),
  })
  const button = card.locator('.favorite-button')
  await card.hover()
  await button.click()
  try {
    await expect(page.locator('.ukiyo-burst').first()).toBeAttached()
    // not-favorite also has a word boundary before favorite
    await expect(button).toHaveClass(/(^|\s)favorite(\s|$)/)
    expect(await backgroundOf(button.locator('svg'))).toContain('hanko.svg')
  } finally {
    await card.hover()
    if (await button.evaluate((el) => el.classList.contains('favorite'))) {
      await button.click()
      await expect(button).toHaveClass(/(^|\s)not-favorite(\s|$)/)
    }
  }
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
    const button = await zoomSeal(page)
    await expect(button).toHaveCSS('opacity', '1')
  })
  test('the rating slip clears the checkbox', async ({ page }) => {
    await page.goto('/scenes')
    const card = page.locator('.scene-card:has(.rating-banner)').first()
    await card.waitFor()
    await slipClearsCheckbox(card)
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
    await expect(page.locator('html')).toHaveClass(/\bukiyo-calm\b/)
    const index = page.locator('.paginationIndex')
    await expect(index).toHaveText(/^0-0 of 0/)
    await expect(index).not.toHaveAttribute('data-ukiyo-empty')
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test('SFW mode drops the voice and the beauty print, keeps the seal', async ({
  page,
}) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    const index = page.locator('.paginationIndex')
    await expect(index).toHaveText(/^0-0 of 0/)
    await expect(index).not.toHaveAttribute('data-ukiyo-empty')
    expect(
      await index.evaluate(
        (el) => getComputedStyle(el, '::before').backgroundImage,
      ),
    ).not.toContain('bijin')
    await page.goto(url('/performers/:performer'))
    const seal = page.locator('.name-icons .favorite-button.favorite svg')
    await seal.waitFor()
    expect(await backgroundOf(seal)).toContain('hanko.svg')
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in ukiyo.css that no visited
// page or flow renders, and which of them still rendered on the baseline
// Stash version (plugins/ukiyo/tests/unmatched-baseline.txt). Those newly
// missing classes point at what a Stash change removed; the rest only appear
// in dialogs, menus or on hover.
test('report Stash classes Ukiyo styles that no page renders', async ({
  page,
}, info) => {
  const newlyMissing = await unmatchedClasses(page, {
    css: 'dist/site/Theme-Ukiyo/ukiyo.css',
    prefix: 'ukiyo',
    folder: 'ukiyo',
  })
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
