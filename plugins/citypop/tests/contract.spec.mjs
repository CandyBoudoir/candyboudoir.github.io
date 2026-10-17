// Checks that Stash still renders the elements City Pop styles and that City
// Pop's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  VOICE_EMPTY_LINE,
  demoIds,
  demoPath,
  onlyCityPop,
  setPlugin,
  setSfw,
  unmatchedClasses,
  visit,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  await onlyCityPop()
  ids = await demoIds()
})
const url = (path) => demoPath(path, ids)

for (const entry of [...PAGES, ...FLOWS]) {
  const [name, path, , selectors] = entry
  test(`${name}: Stash renders the elements City Pop styles`, async ({
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

test('City Pop loads: class, colours, fonts and sun ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/\bcitypop\b/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      background: getComputedStyle(document.body).backgroundColor,
      dafoe: document.fonts.check('400 16px "CityPop Dafoe"'),
      jost: document.fonts.check('500 16px "CityPop Jost"'),
    }
  })
  expect(look.background).toBe('rgb(12, 14, 48)')
  expect(look.dafoe).toBe(true)
  expect(look.jost).toBe(true)
  expect(
    await maskOf(page.locator('.rating-stars .filled-star svg').first()),
  ).toContain('glyph-sun')
  expect(
    await maskOf(
      page
        .locator('.count-button .count-icon svg:not(.svg-inline--fa)')
        .first(),
    ),
  ).toContain('glyph-splash')
})

test('the favourite is a heart', async ({ page }) => {
  await page.goto(url('/performers/:performer'))
  const heart = page.locator('.name-icons .favorite-button svg')
  await heart.waitFor()
  expect(await maskOf(heart)).toContain('glyph-heart')
})

// The catalogue labels on the sleeves set 面 (side) in the Zen Maru Gothic
// subset, which holds only the characters the theme draws.
test('the Japanese subset loads where the theme draws it', async ({ page }) => {
  await page.goto('/scenes')
  await page.locator('.scene-card').first().waitFor()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        await document.fonts.ready
        return document.fonts.check('500 16px "CityPop Zen Maru"', '面')
      }),
    )
    .toBe(true)
})

test('an empty list gets her line', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  await expect(page.locator('.paginationIndex')).toHaveAttribute(
    'data-citypop-empty',
    VOICE_EMPTY_LINE,
  )
})

// City Pop's navbar is taller than Stash's, and Stash spaces the page, the
// filter sidebar and its sticky bars by its own height. City Pop moves them,
// so nothing starts under the bar.
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

// The backdrop sun sets wherever a list, a detail page or the player covers
// the horizon, and rises where the horizon is free, as in Settings.
const sunOpacity = (page) =>
  page.evaluate(() => getComputedStyle(document.body, '::after').opacity)

test('the sun sets behind lists and rises over Settings', async ({ page }) => {
  for (const path of ['/scenes', url('/performers/:performer')]) {
    await page.goto(path)
    await page.locator('.grid-card').first().waitFor()
    await expect.poll(() => sunOpacity(page), path).toBe('0')
  }
  await page.goto(url('/scenes/:scene'))
  await page.locator('.video-js').waitFor()
  await expect.poll(() => sunOpacity(page), 'scene page').toBe('0')
  await page.goto('/settings?tab=plugins')
  await page
    .locator('.setting-section')
    .filter({ visible: true })
    .first()
    .waitFor()
  await expect.poll(() => sunOpacity(page), 'settings').toBe('0.5')
})

// Audio-only scenes get a cassette. citypop.js asks Stash once for the scenes
// on screen with no video stream and no cover; the demo library has none, so
// one check sends the real question and another answers it for one scene.
test("Stash answers City Pop's audio-only question", async ({ page }) => {
  const asked = page.waitForResponse((response) =>
    response.request().postData()?.includes('CityPopAudio'),
  )
  await page.goto('/scenes')
  const body = await (await asked).json()
  expect(body.errors).toBeUndefined()
  expect(Array.isArray(body.data.findScenes.scenes)).toBe(true)
})

test('an audio-only scene is a cassette on a pool', async ({ page }) => {
  await page.route('**/graphql', async (route) => {
    if (!route.request().postData()?.includes('CityPopAudio')) {
      return route.fallback()
    }
    await route.fulfill({
      json: { data: { findScenes: { scenes: [{ id: ids.scene }] } } },
    })
  })
  await page.goto('/scenes')
  const card = page.locator('.scene-card', {
    has: page.locator(`a[href^="/scenes/${ids.scene}?"]`),
  })
  await expect(card.locator('.citypop-audio-cover .citypop-tape')).toBeVisible()
  await expect(card).toHaveClass(/\bcitypop-audio\b/)
  await expect(page.locator('.citypop-audio-cover')).toHaveCount(1)
})

test('a failed audio-only question leaves the covers alone', async ({
  page,
}) => {
  await page.route('**/graphql', (route) =>
    route.request().postData()?.includes('CityPopAudio')
      ? route.fulfill({ status: 500, body: 'no' })
      : route.fallback(),
  )
  await page.goto('/scenes')
  await page.locator('.scene-card-preview-image').first().waitFor()
  await page.waitForTimeout(500)
  await expect(page.locator('.citypop-audio-cover')).toHaveCount(0)
})

// Her page is an open J-card: the spine runs down beside the cover, as tall
// as it, and lies flat under it on a phone.
async function jCard(page) {
  await page.goto(url('/performers/:performer'))
  const cover = await page.locator('.detail-header-image').boundingBox()
  const spine = page.locator('.performer-head > h2')
  return { cover, spine, box: await spine.boundingBox() }
}

test("a performer's header is an open J-card", async ({ page }) => {
  const { cover, spine, box } = await jCard(page)
  await expect(spine).toHaveCSS('writing-mode', 'vertical-rl')
  expect(Math.abs(box.x - (cover.x + cover.width))).toBeLessThan(1.5)
  expect(Math.abs(box.height - cover.height)).toBeLessThan(1.5)
})

// The zoom button on image cards is a glossy sunset bubble in the picture's
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

// The rating sticker sits to the right of the card's checkbox, so the
// checkbox is never covered.
async function stickerClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const sticker = await card.locator('.rating-banner').boundingBox()
  expect(sticker.x).toBeGreaterThan(check.x + check.width)
}

test("a card's rating sticker clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await stickerClearsCheckbox(card)
  await card.locator('.card-check').check()
  await page.mouse.move(0, 0)
  await expect(card.locator('.rating-banner')).toHaveCSS('opacity', '1')
  await stickerClearsCheckbox(card)
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
  test('the rating sticker clears the checkbox', async ({ page }) => {
    await page.goto('/scenes')
    const card = page.locator('.scene-card:has(.rating-banner)').first()
    await card.waitFor()
    await stickerClearsCheckbox(card)
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
  test("the J-card's spine lies flat under the cover", async ({ page }) => {
    const { cover, spine, box } = await jCard(page)
    await expect(spine).toHaveCSS('writing-mode', 'horizontal-tb')
    expect(box.y).toBeGreaterThanOrEqual(cover.y + cover.height - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
  })
})

test('a burst throws glints, suns and drops, and Calm mode stops it', async ({
  page,
}) => {
  await page.goto(EMPTY_LIST)
  await page.locator('.paginationIndex').waitFor()
  const throwBurst = () =>
    page.evaluate(() => {
      window.CityPop.burst(200, 200)
      return [...document.querySelectorAll('.citypop-burst')].map(
        (el) => el.className,
      )
    })
  const kinds = await throwBurst()
  expect(kinds).toHaveLength(12)
  expect(kinds.join(' ')).toContain('is-sun')
  expect(kinds.join(' ')).toContain('is-drop')
  await expect(page.locator('.citypop-burst')).toHaveCount(0)
  await page.evaluate(() => window.CityPop.apply({ calm: true }))
  expect(await throwBurst()).toHaveLength(0)
})

test('Calm mode and Plain labels take effect', async ({ page }) => {
  try {
    await setPlugin({ calmMode: true, plainCopy: true })
    await page.goto(EMPTY_LIST)
    await expect(page.locator('html')).toHaveClass(/\bcitypop-calm\b/)
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-citypop-empty',
      '',
    )
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test('SFW mode drops the voice and the pool drops', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-citypop-empty',
      '',
    )
    const kinds = await page.evaluate(() => {
      window.CityPop.burst(200, 200)
      return [...document.querySelectorAll('.citypop-burst')]
        .map((el) => el.className)
        .join(' ')
    })
    expect(kinds).not.toContain('is-drop')
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in citypop.css that no
// visited page or flow renders, and which of them still rendered on the
// baseline Stash version (plugins/citypop/tests/unmatched-baseline.txt). Those
// newly missing classes point at what a Stash change removed; the rest only
// appear in dialogs, menus or on hover.
test('report Stash classes City Pop styles that no page renders', async ({
  page,
}, info) => {
  const newlyMissing = await unmatchedClasses(page, {
    css: 'dist/site/Theme-CityPop/citypop.css',
    prefix: 'citypop',
    folder: 'citypop',
  })
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
