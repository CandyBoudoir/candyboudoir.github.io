// Checks that Stash still renders the elements Leather styles and that
// Leather's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  PLUGIN_ID,
  STRICT_EMPTY_LINE,
  colorsIn,
  demoIds,
  demoPath,
  onlyLeather,
  openInsights,
  openPerformerStats,
  openPerformersToolkit,
  openRunningJob,
  progressColors,
  setPlugin,
  setSfw,
  unmatchedClasses,
  unmatchedRestyledClasses,
  usePlugins,
  visit,
} from './stash.mjs'
import {
  abandonBracket,
  headerButtonLook,
  openPerformerBracket,
  progressLook,
  setUpCherryPick,
  tearDownCherryPick,
} from '../../cherrypick/tests/stash.mjs'

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

// Leather's rating tab hangs to the right of the card's checkbox, so the
// checkbox is never covered.
async function tabClearsCheckbox(card) {
  const check = await card.locator('.card-check').boundingBox()
  const tab = await card.locator('.rating-banner').boundingBox()
  expect(tab.x).toBeGreaterThan(check.x + check.width)
}

test("a card's rating tab clears its checkbox", async ({ page }) => {
  await page.goto('/scenes')
  const card = page.locator('.scene-card:has(.rating-banner)').first()
  await card.hover()
  await tabClearsCheckbox(card)
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

test('SFW mode drops the voice and the collar', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-leather-empty',
      '',
    )
    await page.goto('/performers')
    const favourite = page
      .locator('.performer-card .favorite-button svg')
      .first()
    await favourite.waitFor()
    expect(await maskOf(favourite)).toContain('glyph-stud')
  } finally {
    await setSfw(false)
  }
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

// A running job's bar in Settings > Tasks is a red strap in a debossed
// groove, its label in white, not Bootstrap's blue on white.
test("a running job's progress fills brighter than its groove", async ({
  page,
}) => {
  const progress = await openRunningJob(page)
  const { fill, groove } = await progressColors(page, progress)
  const black = 'rgb(0, 0, 0)'
  expect(contrast(fill, black)).toBeGreaterThan(contrast(groove, black))
  expect(contrast(fill, groove)).toBeGreaterThanOrEqual(3)
  const label = await progress
    .locator('.progress-bar')
    .evaluate((el) => getComputedStyle(el).color)
  expect(contrast(label, fill)).toBeGreaterThanOrEqual(4.5)
})

// Cherry Pick's bracket dialogs: the speaker in the header and the bar of
// the bracket's progress, and its setup sheet's radios
test.describe('beside Cherry Pick', () => {
  test.use({ reducedMotion: 'reduce' })
  test.beforeAll(async () => {
    await setUpCherryPick()
    await usePlugins('CherryPick', PLUGIN_ID)
  })
  test.afterAll(async () => {
    await tearDownCherryPick()
    await onlyLeather()
  })

  // The speaker takes its button's ink, white on blood red when sound is on,
  // and has no rivets, which met over its icon.
  test("the speaker in a bracket's header reads, sound off and on", async ({
    page,
  }) => {
    const play = await openPerformerBracket(page)
    const sound = play.locator('.cherrypick-sound')
    const widths = []
    for (const on of [false, true]) {
      if (on) await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', String(on))
      const look = await headerButtonLook(page, sound)
      expect(look.icon, "the button's ink").toBe(look.ink)
      expect(contrast(look.icon, look.behind)).toBeGreaterThanOrEqual(3)
      widths.push(look.width)
    }
    expect(widths[1]).toBeCloseTo(widths[0], 0)
    await abandonBracket(play)
  })

  // The bracket's bar is the red strap of every progress bar
  test("a bracket's progress fills brighter than its groove", async ({
    page,
  }) => {
    const play = await openPerformerBracket(page)
    await page.keyboard.press('ArrowLeft')
    await expect(play.locator('.cherrypick-round')).toContainText(
      'match 2 of 8',
    )
    const { fill, groove } = await progressLook(page, play)
    const black = 'rgb(0, 0, 0)'
    expect(contrast(fill, black)).toBeGreaterThan(contrast(groove, black))
    expect(contrast(fill, groove)).toBeGreaterThanOrEqual(3)
    await abandonBracket(play)
  })

  // The close button reads on the black leather
  test("a bracket dialog's close button reads", async ({ page }) => {
    const play = await openPerformerBracket(page)
    const close = play.locator('.modal-header .close')
    await expect(close).toHaveCSS('opacity', '1')
    const look = await headerButtonLook(page, close, '[aria-hidden="true"]')
    expect(contrast(look.icon, look.behind)).toBeGreaterThanOrEqual(4.5)
    await abandonBracket(play)
  })

  // An unchecked radio in the setup sheet's Pool keeps its debossed well,
  // rimmed so it reads on the black leather. Its rim at its lightest against
  // the leather beside it at its lightest, on a 2x screen, where the 1px rim
  // fills whole screen pixels.
  test.describe('on a 2x screen', () => {
    test.use({ deviceScaleFactor: 2 })
    test("an unchecked radio's rim reads on the leather", async ({ page }) => {
      await page.goto('/performers')
      const options = page
        .locator('.cherrypick-options-link')
        .filter({ visible: true })
        .first()
      await expect(options).toBeEnabled({ timeout: 20_000 })
      await options.click()
      const label = page
        .locator(
          '.cherrypick-pools .custom-control-input:not(:checked, :disabled) ~ .custom-control-label',
        )
        .first()
      const box = await label.boundingBox()
      const ring = await label.evaluate((el) => {
        const style = getComputedStyle(el, '::before')
        return {
          left: parseFloat(style.left),
          middle: parseFloat(style.top) + parseFloat(style.height) / 2,
        }
      })
      const x = box.x + ring.left
      const y = box.y + ring.middle
      const black = 'rgb(0, 0, 0)'
      const lightest = (colors) =>
        colors.reduce((a, b) =>
          contrast(b, black) > contrast(a, black) ? b : a,
        )
      const rim = lightest(
        await colorsIn(page, { x: x - 1, y, width: 3, height: 1 }),
      )
      const leather = lightest(
        await colorsIn(page, { x: x - 6, y, width: 4, height: 1 }),
      )
      expect(contrast(rim, leather)).toBeGreaterThanOrEqual(3)
      await page.keyboard.press('Escape')
    })
  })
})

// Insights, another author's stats dashboard on the Stats page (RESTYLED in
// tests/stash/companions.mjs), takes Leather's colours by itself, and with
// Restyle Insights on takes Leather's palette, panels and type. Its sidebar
// clears Leather's taller navbar either way.
test.describe('beside Insights', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'Insights')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyLeather()
  })

  // Insights 2.12 and later work out their colours from the page (in
  // <style id="insights-sx">), so before the restyle is on Insights already
  // sits on Leather's page in Leather's colours
  test("Insights takes Leather's colours by itself until the restyle is on", async ({
    page,
  }) => {
    await setPlugin({})
    await openInsights(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\bleather-restyle-insights\b/,
    )
    await expect(page.locator('style#insights-sx')).toHaveCount(1)
    await expect(page.locator('#insights')).toHaveCSS(
      'background-color',
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    )
  })

  test('the restyle puts Insights in black leather', async ({ page }) => {
    try {
      await setPlugin({ restyleInsights: true })
      await openInsights(page, 'library')
      await expect(page.locator('html')).toHaveClass(
        /\bleather-restyle-insights\b/,
      )
      const root = page.locator('#insights')
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // Insights' own rules still paint from the palette Leather gives it
      await expect(root).toHaveCSS('--ui', '#151113')
      // and so do its newer ones, from its own tokens, and its calendars,
      // whose empty days sit in the well
      for (const [name, value] of [
        ['--sx-ui', '#0a0809'],
        ['--ins-o4', '#b9aea9'],
      ])
        await expect(root).toHaveCSS(name, value)
      await expect(root.locator('.ins-sub').first()).toHaveCSS(
        'color',
        'rgb(148, 138, 139)',
      )
      const card = root.locator('.ins-card').first()
      await expect(card).toHaveCSS('border-radius', '6px')
      await expect(card).toHaveCSS('background-image', /leather-1x\.webp/)
      await expect(root.locator('.ins-title')).toHaveCSS(
        'font-family',
        /Leather Grenze/,
      )
      // Numbers stay off the blackletter
      await expect(root.locator('.ins-hero .big').first()).toHaveCSS(
        'font-family',
        /Leather Oswald/,
      )
      await root
        .locator('.ins-bar[data-tip]')
        .filter({ visible: true })
        .first()
        .hover()
      const tip = page.locator('#ins-tip')
      await expect(tip).toBeVisible()
      await expect(tip).toHaveCSS('background-color', 'rgb(34, 27, 30)')
      await expect(tip).toHaveCSS('color', 'rgb(236, 230, 227)')
    } finally {
      await setPlugin({})
    }
  })

  test('the restyle takes effect on the next page', async ({ page }) => {
    try {
      await setPlugin({})
      await page.goto(EMPTY_LIST)
      await page.locator('.paginationIndex').waitFor()
      await expect(page.locator('html')).not.toHaveClass(
        /\bleather-restyle-insights\b/,
      )
      await setPlugin({ restyleInsights: true })
      await page
        .locator('a[href="/stats"]')
        .filter({ visible: true })
        .first()
        .click()
      await expect(page.locator('html')).toHaveClass(
        /\bleather-restyle-insights\b/,
      )
      // Kept for the next visit, so Stats never opens in Insights' colours
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('leather.restyle')).insights,
        ),
      ).toBe(true)
    } finally {
      await setPlugin({})
    }
  })

  test("the What works sidebar clears Leather's navbar", async ({ page }) => {
    await setPlugin({})
    await openInsights(page, 'you')
    await expect(page.locator('#insights .ins-side')).toHaveCSS(
      'top',
      '75.25px',
    )
  })

  // The Insights classes in leather.css that no tab renders on the demo
  // library, against the ones that matched nothing on the pinned Insights
  // (plugins/leather/tests/insights-unmatched-baseline.txt). A class that
  // newly matches nothing is one an Insights release renamed or removed.
  test('every Insights class Leather styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-Leather/leather.css',
        folder: 'leather',
        plugin: 'insights',
      }),
    ).toEqual([])
  })
})

// Performers Toolkit, from the same author and in the same look as
// Insights, has a setting of its own, Restyle Performers Toolkit: its page,
// the Stats tab it adds to a performer's page and its toast take Leather's
// palette, panels and type.
test.describe('beside Performers Toolkit', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyLeather()
  })

  // As Insights, from 0.13 (in <style id="performerstoolkit-sx">)
  test("Performers Toolkit takes Leather's colours by itself until the restyle is on", async ({
    page,
  }) => {
    await setPlugin({})
    await openPerformersToolkit(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\bleather-restyle-toolkit\b/,
    )
    await expect(page.locator('style#performerstoolkit-sx')).toHaveCount(1)
    await expect(page.locator('.pt').first()).toHaveCSS(
      'background-color',
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    )
  })

  test('the restyle puts Performers Toolkit in black leather', async ({
    page,
  }) => {
    try {
      await setPlugin({ restylePerformersToolkit: true })
      await openPerformersToolkit(page)
      await expect(page.locator('html')).toHaveClass(
        /\bleather-restyle-toolkit\b/,
      )
      const root = page.locator('.pt').first()
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(root.locator('.pt-title')).toHaveCSS(
        'font-family',
        /Leather Grenze/,
      )
      await expect(root.locator('.pt-card').first()).toHaveCSS(
        'border-radius',
        '6px',
      )
      await expect(root.locator('.pt-btn.pt-pri').first()).toHaveCSS(
        'background-image',
        /rgb\(196, 34, 57\)/,
      )
      await openPerformerStats(page, ids.performer)
      const stats = page.locator('.ptc').first()
      // Its own rules still paint from the palette Leather gives it
      // (read at each try: the toolkit draws the tab anew as each of its
      // lookups returns, and the one it just replaced reads empty)
      await expect(stats).toHaveCSS('--ui', '#151113')
      await expect(stats).toHaveCSS('--sx-ui', '#151113')
      await expect(stats.locator('.pt-kpi').first()).toHaveCSS(
        'background-image',
        /leather-1x\.webp/,
      )
    } finally {
      await setPlugin({})
    }
  })

  // The Catalog tab's count is a Stash badge in a Stash tab, which also
  // carries Performers Toolkit's badge class. It shows once a stash-box has
  // answered, which the mock stash-box does not, so the test shows it. It
  // keeps Leather's type with the setting off too.
  for (const restyle of [false, true]) {
    test(`the Catalog tab's count keeps Leather's tag type, restyle ${restyle ? 'on' : 'off'}`, async ({
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
        await expect(badge).toHaveCSS('color', 'rgb(236, 230, 227)')
        await tab.click()
        await expect(
          page.locator('.pt-tablink[data-pt-tab="catalog"].active'),
        ).toBeAttached()
        await show()
        await expect(badge).toHaveCSS('color', 'rgb(236, 230, 227)')
      } finally {
        await setPlugin({})
      }
    })
  }

  // As for Insights, against
  // plugins/leather/tests/performerstoolkit-unmatched-baseline.txt
  test('every Performers Toolkit class Leather styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-Leather/leather.css',
        folder: 'leather',
        plugin: 'performerstoolkit',
      }),
    ).toEqual([])
  })
})

// Each restyle setting shows in Settings > Plugins only while its plugin
// is on, since it has nothing to restyle otherwise. Leather hides its row
// with display: none; the row's section may be collapsed (Stash develop
// starts plugin settings closed), so the test reads the row's display.
test('each restyle setting shows only while its plugin is on', async ({
  page,
}) => {
  const row = (setting) =>
    page.locator('.setting', {
      has: page.locator(`[id="plugin-${PLUGIN_ID}-${setting}"]`),
    })
  const shown = (setting) =>
    row(setting).evaluate((el) => getComputedStyle(el).display !== 'none')
  const rows = async (insights, toolkit) => {
    await page.goto('/settings?tab=plugins')
    await row('calmMode').waitFor({ state: 'attached' })
    await expect.poll(() => shown('calmMode')).toBe(true)
    await expect.poll(() => shown('restyleInsights')).toBe(insights)
    await expect.poll(() => shown('restylePerformersToolkit')).toBe(toolkit)
  }
  try {
    await rows(false, false)
    await usePlugins(PLUGIN_ID, 'Insights')
    await rows(true, false)
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
    await rows(false, true)
  } finally {
    await onlyLeather()
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
