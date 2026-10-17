// Checks that Stash still renders the elements Screentone styles and that
// Screentone's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LINE,
  EMPTY_LIST,
  FLOWS,
  PAGES,
  demoIds,
  demoPath,
  gql,
  onlyScreentone,
  setPlugin,
  setSfw,
  unmatchedClasses,
  visit,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  await onlyScreentone()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

for (const entry of [...PAGES, ...FLOWS]) {
  const [name, path, , selectors] = entry
  test(`${name}: Stash renders the elements Screentone styles`, async ({
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

// A pseudo-element's computed property, such as the SFX in ::after.
const pseudo = (locator, which, property) =>
  locator.evaluate(
    (el, [which, property]) => getComputedStyle(el, which)[property],
    [which, property],
  )

test('Screentone loads: class, colours, fonts and star ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/\bscreentone\b/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      background: getComputedStyle(document.body).backgroundColor,
      dela: document.fonts.check('400 16px "Screentone Dela"'),
      brush: document.fonts.check('400 16px "Screentone Brush"'),
      kaku: document.fonts.check('700 16px "Screentone Kaku"'),
    }
  })
  expect(look.background).toBe('rgb(0, 0, 0)')
  expect(look.dela).toBe(true)
  expect(look.brush).toBe(true)
  expect(look.kaku).toBe(true)
  expect(
    await maskOf(page.locator('.rating-stars .filled-star svg').first()),
  ).toContain('glyph-star')
  expect(
    await maskOf(
      page
        .locator('.count-button .count-icon svg:not(.svg-inline--fa)')
        .first(),
    ),
  ).toContain('glyph-drop')
})

// The SFX are lettered in Dela Gothic One from a subset that holds only the
// kana and kanji the theme draws, loaded under its own unicode-range.
test('the SFX kana come from the small Dela subset', async ({ page }) => {
  await page.goto('/scenes')
  await page.locator('.scene-card').first().waitFor()
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load(
      '400 16px "Screentone Dela"',
      'ドン',
    )
    return faces.length
  })
  expect(loaded).toBeGreaterThan(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .map((e) => e.name.split('/').pop())
          .filter((n) => n.startsWith('dela-gothic-one-sfx')),
      ),
    )
    .toContain('dela-gothic-one-sfx-400-normal.woff2')
})

test('the favourite is a heart that pops ドキッ on hover and keyboard focus', async ({
  page,
}) => {
  await page.goto(url('/performers/:performer'))
  const favourite = page.locator('.name-icons .favorite-button')
  await favourite.waitFor()
  expect(await maskOf(favourite.locator('svg'))).toContain('glyph-heart')
  // A performer who is not a favourite yet becomes one, and goes back after
  const toggled = await favourite.evaluate((el) =>
    el.classList.contains('not-favorite'),
  )
  if (toggled) await favourite.click()
  try {
    await expect(favourite).toHaveClass(/\bfavorite\b/)
    expect(await pseudo(favourite, '::after', 'content')).toBe('"ドキッ"')
    await page.mouse.move(0, 0)
    await expect.poll(() => pseudo(favourite, '::after', 'opacity')).toBe('0')
    await favourite.hover()
    await expect.poll(() => pseudo(favourite, '::after', 'opacity')).toBe('1')
    await page.mouse.move(0, 0)
    await favourite.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(favourite).toBeFocused()
    await expect.poll(() => pseudo(favourite, '::after', 'opacity')).toBe('1')
  } finally {
    if (toggled) {
      await favourite.click()
      await expect(favourite).toHaveClass(/\bnot-favorite\b/)
    }
  }
})

test('an empty list gets her line', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  await expect(page.locator('.paginationIndex')).toHaveAttribute(
    'data-screentone-empty',
    EMPTY_LINE,
  )
})

// Screentone's navbar is taller than Stash's, and Stash spaces the page, the
// filter sidebar and its sticky bars by its own height. Screentone moves
// them, so nothing starts under the bar.
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

// The performer header is a two-panel spread: her picture in one panel, her
// name in the next, ドン across the gutter and her details in a paper box.
test('the performer header is a two-panel spread', async ({ page }) => {
  await page.goto(url('/performers/:performer'))
  const header = page.locator('#performer-page .detail-header')
  await header.waitFor()
  const picture = await header.locator('.detail-header-image').boundingBox()
  const name = await header.locator('.performer-name').boundingBox()
  expect(name.x).toBeGreaterThan(picture.x + picture.width / 2)
  expect(name.y).toBeLessThan(picture.y + picture.height / 2)
  expect(
    await header
      .locator('.detail-container')
      .evaluate((el) => getComputedStyle(el).display),
  ).toBe('grid')
  expect(
    await pseudo(header.locator('.detail-container'), '::after', 'content'),
  ).toBe('"ドン"')
  await expect(header.locator('.detail-group')).toHaveCSS(
    'background-color',
    'rgb(253, 252, 249)',
  )
  // The buttons sit under the spread, clear of the left edge
  const edit = await header.getByRole('button', { name: 'Edit' }).boundingBox()
  expect(edit.y).toBeGreaterThan(picture.y + picture.height - 1)
  expect(edit.x).toBeGreaterThanOrEqual(picture.x - 1)
})

// Stash's Enable background image setting is the viewer's; the spread shows
// the blurred picture through its gutters instead of hiding it.
test("the performer background image follows Stash's setting", async ({
  page,
}) => {
  const set = (on) =>
    gql(
      'mutation ($on: Boolean) { configureUI(partial: { enablePerformerBackgroundImage: $on }) }',
      { on },
    )
  try {
    await set(true)
    await page.goto(url('/performers/:performer'))
    const backdrop = page.locator(
      '#performer-page .detail-header .background-image-container',
    )
    await expect(backdrop).toBeVisible()
    expect(
      await backdrop
        .locator('.background-image')
        .evaluate((el) => getComputedStyle(el).filter),
    ).toContain('grayscale(1)')
  } finally {
    await set(false)
  }
})

// The zoom button on image cards is a paper bubble in the picture's
// bottom-right corner. Stash draws it as a big magnifier over the middle.
async function zoomBubble(page) {
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
  await zoomBubble(page)
  await button.click()
  await expect(page.locator('.Lightbox')).toBeVisible()
})

// The rating caption sits to the right of the card's checkbox, so the
// checkbox is never covered.
async function captionClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const caption = await card.locator('.rating-banner').boundingBox()
  expect(caption.x).toBeGreaterThan(check.x + check.width)
}

test("a card's rating caption clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await captionClearsCheckbox(card)
  await card.locator('.card-check').check()
  await page.mouse.move(0, 0)
  await expect(card.locator('.rating-banner')).toHaveCSS('opacity', '1')
  await captionClearsCheckbox(card)
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
    const button = await zoomBubble(page)
    await expect(button).toHaveCSS('opacity', '1')
  })
  test('the rating caption clears the checkbox', async ({ page }) => {
    await page.goto('/scenes')
    const card = page.locator('.scene-card:has(.rating-banner)').first()
    await card.waitFor()
    await captionClearsCheckbox(card)
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
  test('the performer spread stacks, her picture over her name', async ({
    page,
  }) => {
    await page.goto(url('/performers/:performer'))
    const header = page.locator('#performer-page .detail-header')
    await header.waitFor()
    const picture = await header.locator('.detail-header-image').boundingBox()
    const name = await header.locator('.performer-name').boundingBox()
    expect(name.y).toBeGreaterThan(picture.y + picture.height / 2)
    expect(picture.width).toBeGreaterThan(300)
  })
})

// Stash fades its loader in from nothing with an animation. With motion
// stopped the loader must still show, so this drops one into the page.
const loaderOpacity = (page) =>
  page.evaluate(() => {
    const box = document.createElement('div')
    box.className = 'LoadingIndicator'
    box.innerHTML = '<div class="spinner-border"></div>'
    document.body.append(box)
    return new Promise((resolve) =>
      setTimeout(() => resolve(getComputedStyle(box).opacity), 600),
    )
  })

test('Calm mode and Plain labels take effect', async ({ page }) => {
  try {
    await setPlugin({ calmMode: true, plainCopy: true })
    await page.goto(EMPTY_LIST)
    await expect(page.locator('html')).toHaveClass(/\bscreentone-calm\b/)
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-screentone-empty',
      '',
    )
    expect(await loaderOpacity(page)).toBe('1')
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the loader still shows', async ({ page }) => {
    await page.goto('/scenes')
    await page.locator('.scene-card').first().waitFor()
    expect(await loaderOpacity(page)).toBe('1')
  })
})

test('SFW mode drops the voice, the SFX and the figure', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    const index = page.locator('.paginationIndex')
    await expect(index).toHaveAttribute('data-screentone-empty', '')
    expect(await pseudo(index, '::before', 'backgroundImage')).toContain(
      'silence.svg',
    )
    await page.goto('/performers')
    const card = page.locator('.performer-card').first()
    await card.waitFor()
    expect(
      await pseudo(card.locator('.thumbnail-section'), '::after', 'content'),
    ).toBe('none')
    expect(
      await pseudo(card.locator('.favorite-button'), '::after', 'content'),
    ).toBe('none')
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in screentone.css that no
// visited page or flow renders, and which of them still rendered on the
// baseline Stash version (plugins/screentone/tests/unmatched-baseline.txt).
// Those newly missing classes point at what a Stash change removed; the rest
// only appear in dialogs, menus or on hover.
test('report Stash classes Screentone styles that no page renders', async ({
  page,
}, info) => {
  const newlyMissing = await unmatchedClasses(page, {
    css: 'dist/site/Theme-Screentone/screentone.css',
    prefix: 'screentone',
    folder: 'screentone',
  })
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
