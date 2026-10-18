// Checks that Stash still renders the elements City Pop styles and that City
// Pop's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  setUpCherryPick,
  tearDownCherryPick,
} from '../../cherrypick/tests/stash.mjs'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  PLUGIN_ID,
  VOICE_EMPTY_LINE,
  demoIds,
  demoPath,
  onlyCityPop,
  openInsights,
  openPerformerStats,
  openPerformersToolkit,
  setPlugin,
  setSfw,
  unmatchedClasses,
  unmatchedRestyledClasses,
  usePlugins,
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

// WCAG contrast between two computed colours, which must be opaque.
function contrast(a, b) {
  const luminance = (rgb) => {
    const [r, g, bl] = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
    const linear = (c) =>
      c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(bl)
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const alpha = (rgb) => Number(rgb.match(/[\d.]+/g)[3] ?? 1)

// Cherry Pick's Your score sits where the rating sticker does, on scenes you
// haven't rated. City Pop draws it as a blank sticker: an opaque night panel
// with a dashed edge, whose type reads over any cover.
test.describe('beside Cherry Pick', () => {
  test.beforeAll(async () => {
    await setUpCherryPick()
    await usePlugins('CherryPick', PLUGIN_ID)
  })
  test.afterAll(async () => {
    await tearDownCherryPick()
    await onlyCityPop()
  })

  test("Your score's banner reads over any cover", async ({ page }) => {
    await page.goto('/scenes?sortby=title&perPage=120')
    const card = page
      .locator('.scene-card:has(.cherrypick-score-banner)')
      .first()
    const banner = card.locator('.cherrypick-score-banner')
    await expect(banner).toBeVisible({ timeout: 20_000 })
    const { color, background } = await banner.evaluate((el) => {
      const style = getComputedStyle(el)
      return { color: style.color, background: style.backgroundColor }
    })
    expect(alpha(background), 'an opaque panel').toBe(1)
    expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
    await expect(banner).toHaveCSS('outline-style', 'dashed')
    await card.hover()
    await expect(banner).toHaveCSS('opacity', '1')
    await stickerClearsCheckbox(card)
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

// Insights, another author's stats dashboard on the Stats page (RESTYLED in
// tests/stash/companions.mjs), keeps its own look until Restyle Insights and
// Performers Toolkit is on, and then takes City Pop's palette, panels and
// type. Its sidebar clears
// City Pop's taller navbar either way.
test.describe('beside Insights', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'Insights')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyCityPop()
  })

  test('Insights keeps its own look until the restyle is on', async ({
    page,
  }) => {
    await setPlugin({})
    await openInsights(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\bcitypop-restyle-insights\b/,
    )
    await expect(page.locator('#insights')).toHaveCSS(
      'background-color',
      'rgb(16, 15, 15)',
    )
  })

  test('Restyle Insights puts Insights in the dusk', async ({ page }) => {
    try {
      await setPlugin({ restyleInsights: true })
      await openInsights(page, 'library')
      await expect(page.locator('html')).toHaveClass(
        /\bcitypop-restyle-insights\b/,
      )
      const root = page.locator('#insights')
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // Insights' own rules still paint from the palette City Pop gives it
      expect(
        await root.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--ui').trim(),
        ),
      ).toBe('#1a1848')
      await expect(root.locator('.ins-sub').first()).toHaveCSS(
        'color',
        'rgb(163, 155, 211)',
      )
      await expect(root.locator('.ins-card').first()).toHaveCSS(
        'border-radius',
        '4px',
      )
      await expect(root.locator('.ins-title')).toHaveCSS(
        'font-family',
        /CityPop Dafoe/,
      )
      await root
        .locator('.ins-bar[data-tip]')
        .filter({ visible: true })
        .first()
        .hover()
      const tip = page.locator('#ins-tip')
      await expect(tip).toBeVisible()
      await expect(tip).toHaveCSS('background-color', 'rgb(255, 246, 234)')
      await expect(tip).toHaveCSS('color', 'rgb(27, 17, 69)')
    } finally {
      await setPlugin({})
    }
  })

  test('Restyle Insights takes effect on the next page', async ({ page }) => {
    try {
      await setPlugin({})
      await page.goto(EMPTY_LIST)
      await page.locator('.paginationIndex').waitFor()
      await expect(page.locator('html')).not.toHaveClass(
        /\bcitypop-restyle-insights\b/,
      )
      await setPlugin({ restyleInsights: true })
      await page
        .locator('a[href="/stats"]')
        .filter({ visible: true })
        .first()
        .click()
      await expect(page.locator('html')).toHaveClass(
        /\bcitypop-restyle-insights\b/,
      )
      // Kept for the next visit, so Stats never opens in Insights' colours
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('citypop.restyle')).insights,
        ),
      ).toBe(true)
    } finally {
      await setPlugin({})
    }
  })

  test("the What works sidebar clears City Pop's navbar", async ({ page }) => {
    await setPlugin({})
    await openInsights(page, 'you')
    await expect(page.locator('#insights .ins-side')).toHaveCSS(
      'top',
      '71.25px',
    )
  })

  // The Insights classes in citypop.css that no tab renders on the demo
  // library, against the ones that matched nothing on the pinned Insights
  // (plugins/citypop/tests/insights-unmatched-baseline.txt). A class that
  // newly matches nothing is one an Insights release renamed or removed.
  test('every Insights class City Pop styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-CityPop/citypop.css',
        folder: 'citypop',
        plugin: 'insights',
      }),
    ).toEqual([])
  })
})

// Performers Toolkit, from the same author and in the same look as
// Insights, follows the same setting: its page, the Stats tab it adds to a
// performer's page and its toast take City Pop's palette, panels and type.
test.describe('beside Performers Toolkit', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyCityPop()
  })

  test('Performers Toolkit keeps its own look until the restyle is on', async ({
    page,
  }) => {
    await setPlugin({})
    await openPerformersToolkit(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\bcitypop-restyle-toolkit\b/,
    )
    await expect(page.locator('.pt').first()).toHaveCSS(
      'background-color',
      'rgb(16, 15, 15)',
    )
  })

  test('the restyle puts Performers Toolkit in the dusk', async ({ page }) => {
    try {
      await setPlugin({ restylePerformersToolkit: true })
      await openPerformersToolkit(page)
      await expect(page.locator('html')).toHaveClass(
        /\bcitypop-restyle-toolkit\b/,
      )
      const root = page.locator('.pt').first()
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(root.locator('.pt-title')).toHaveCSS(
        'font-family',
        /CityPop Dafoe/,
      )
      await expect(root.locator('.pt-card').first()).toHaveCSS(
        'border-radius',
        '4px',
      )
      await openPerformerStats(page, ids.performer)
      const stats = page.locator('.ptc').first()
      // Its own rules still paint from the palette City Pop gives it
      expect(
        await stats.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--ui').trim(),
        ),
      ).toBe('#1a1848')
      await expect(stats.locator('.pt-sec').first()).toHaveCSS(
        'background-image',
        /rgb\(31, 28, 85\)/,
      )
    } finally {
      await setPlugin({})
    }
  })

  // The Catalog tab's count is a Stash badge in a Stash tab, which also
  // carries Performers Toolkit's badge class, with its own navy type. It
  // shows once a stash-box has answered, which the mock stash-box does not,
  // so the test shows it. City Pop's tab colours win with the restyle on
  // and off.
  for (const restyle of [false, true]) {
    test(`the Catalog tab's count reads, closed and open, restyle ${restyle ? 'on' : 'off'}`, async ({
      page,
    }) => {
      try {
        await setPlugin(restyle ? { restylePerformersToolkit: true } : {})
        await openPerformerStats(page, ids.performer)
        const tab = page.locator('.pt-tablink[data-pt-tab="catalog"]')
        const badge = tab.locator('.badge')
        const show = () =>
          badge.evaluate((el) => {
            el.hidden = false
            el.textContent = '12'
          })
        await show()
        const { color, background } = await badge.evaluate((el) => {
          const style = getComputedStyle(el)
          return { color: style.color, background: style.backgroundColor }
        })
        expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
        await tab.click()
        await expect(tab).toHaveClass(/\bactive\b/)
        await show()
        await expect(badge).toHaveCSS('color', 'rgb(27, 17, 69)')
      } finally {
        await setPlugin({})
      }
    })
  }

  // As for Insights, against
  // plugins/citypop/tests/performerstoolkit-unmatched-baseline.txt
  test('every Performers Toolkit class City Pop styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-CityPop/citypop.css',
        folder: 'citypop',
        plugin: 'performerstoolkit',
      }),
    ).toEqual([])
  })
})

// Each restyle setting shows in Settings > Plugins only while its plugin
// is on, since it has nothing to restyle otherwise
test('each restyle setting shows only while its plugin is on', async ({
  page,
}) => {
  const row = (setting) =>
    page.locator('.setting', {
      has: page.locator(`[id="plugin-${PLUGIN_ID}-${setting}"]`),
    })
  const rows = async (insights, toolkit) => {
    await page.goto('/settings?tab=plugins')
    await row('calmMode').waitFor()
    await expect(row('restyleInsights')).toBeVisible({ visible: insights })
    await expect(row('restylePerformersToolkit')).toBeVisible({
      visible: toolkit,
    })
  }
  try {
    await rows(false, false)
    await usePlugins(PLUGIN_ID, 'Insights')
    await rows(true, false)
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
    await rows(false, true)
  } finally {
    await onlyCityPop()
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
