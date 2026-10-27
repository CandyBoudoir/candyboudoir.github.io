// Checks that Stash still renders the elements Overclock styles and that
// Overclock's CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  EMPTY_LIST,
  FLOWS,
  PAGES,
  PLUGIN_ID,
  VOICE_EMPTY_LINE,
  demoIds,
  demoPath,
  onlyOverclock,
  openInsights,
  openPerformerStats,
  openPerformersToolkit,
  setPlugin,
  setSfw,
  switchSetting,
  unmatchedClasses,
  unmatchedRestyledClasses,
  usePlugins,
  visit,
} from './stash.mjs'
import {
  abandonBracket,
  headerButtonLook,
  openPerformerBracket,
  setUpCherryPick,
  sizeMarkLook,
  tearDownCherryPick,
} from '../../cherrypick/tests/stash.mjs'

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

// Cherry Pick's Your score sits where the rating tag does, on scenes you
// haven't rated. Overclock draws it as the tag left hollow: an opaque black
// panel with a yellow frame, whose type reads over any cover.
test.describe('beside Cherry Pick', () => {
  test.beforeAll(async () => {
    await setUpCherryPick()
    await usePlugins('CherryPick', PLUGIN_ID)
  })
  test.afterAll(async () => {
    await tearDownCherryPick()
    await onlyOverclock()
  })

  test("Your score's tag reads over any cover", async ({ page }) => {
    await page.goto('/scenes?sortby=title&perPage=120')
    const card = page
      .locator('.scene-card:has(.cherrypick-score-banner)')
      .first()
    const tag = card.locator('.cherrypick-score-banner')
    await expect(tag).toBeVisible({ timeout: 20_000 })
    const { color, background } = await tag.evaluate((el) => {
      const style = getComputedStyle(el)
      return { color: style.color, background: style.backgroundColor }
    })
    expect(alpha(background), 'an opaque panel').toBe(1)
    expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
    await expect(tag).toHaveCSS('border-top-style', 'solid')
    await card.hover()
    await expect(tag).toHaveCSS('opacity', '1')
    await tagClearsCheckbox(card)
  })

  // The yellow Overclock gives a dialog's header icon is for the one before
  // the title. The speaker in a bracket's header takes its button's ink, so
  // it reads on yellow when sound is on.
  test("the speaker in a bracket's header reads, sound off and on", async ({
    page,
  }) => {
    const play = await openPerformerBracket(page)
    const sound = play.locator('.cherrypick-sound')
    for (const on of [false, true]) {
      if (on) await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', String(on))
      const look = await headerButtonLook(page, sound)
      expect(look.icon, "the button's ink").toBe(look.ink)
      expect(contrast(look.icon, look.behind)).toBeGreaterThanOrEqual(3)
    }
    // the Abandon question turns the header into a hazard band, which hides
    // the icon before a title; the speaker keeps its own, and the close
    // button reads on a black plate
    await play.getByRole('button', { name: 'Abandon', exact: true }).click()
    await expect(play.locator('.modal-footer .btn-danger')).toBeVisible()
    await expect(sound.locator('svg')).toBeVisible()
    const { color, background } = await play
      .locator('.modal-header .close')
      .evaluate((el) => {
        const style = getComputedStyle(el)
        return { color: style.color, background: style.backgroundColor }
      })
    expect(alpha(background), 'an opaque plate').toBe(1)
    expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
    await abandonBracket(play)
  })

  // A map size not picked shows its mark in full while pointed at, in the
  // yellow Overclock's hover gives a button's ink, and when reached with the
  // keyboard.
  test('a map size not picked reads while pointed at or focused', async ({
    page,
  }) => {
    const play = await openPerformerBracket(page)
    for (const by of ['pointer', 'keyboard']) {
      const look = await sizeMarkLook(page, play, by)
      expect(contrast(look.mark, look.behind), by).toBeGreaterThanOrEqual(3)
    }
    await abandonBracket(play)
  })

  // Cherry Pick's dialogs have a close button, which ends the header after
  // the SYS.DLG readout
  test("a bracket dialog's close button ends its header", async ({ page }) => {
    const play = await openPerformerBracket(page)
    const close = play.locator('.modal-header .close')
    const readout = await play
      .locator('.modal-header')
      .evaluate((el) => parseFloat(getComputedStyle(el, '::after').width))
    expect(readout).toBeGreaterThan(0)
    // no auto margin to share the free space with the readout's
    await expect(close).toHaveCSS('margin-left', '0px')
    const endsHeader = async () => {
      const header = await play.locator('.modal-header').boundingBox()
      const box = await close.boundingBox()
      expect(header.x + header.width - (box.x + box.width)).toBeLessThan(
        box.width,
      )
    }
    await endsHeader()
    // a phone drops the readout, and the close button keeps the header's end
    await page.setViewportSize({ width: 390, height: 844 })
    await expect
      .poll(() =>
        play
          .locator('.modal-header')
          .evaluate((el) => getComputedStyle(el, '::after').content),
      )
      .toBe('none')
    await endsHeader()
    await abandonBracket(play)
  })
})

test.describe('beside Insights', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'Insights')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyOverclock()
  })

  // Insights 2.12 and later work out their colours from the page (in
  // <style id="insights-sx">), so before the restyle is on Insights already
  // sits on Overclock's page in Overclock's colours
  test("Insights takes Overclock's colours by itself until the restyle is on", async ({
    page,
  }) => {
    await setPlugin({})
    await openInsights(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\boverclock-restyle-insights\b/,
    )
    await expect(page.locator('style#insights-sx')).toHaveCount(1)
    await expect(page.locator('#insights')).toHaveCSS(
      'background-color',
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    )
  })

  test('the restyle puts Insights on the display', async ({ page }) => {
    try {
      await setPlugin({ restyleInsights: true })
      await openInsights(page, 'library')
      await expect(page.locator('html')).toHaveClass(
        /\boverclock-restyle-insights\b/,
      )
      const root = page.locator('#insights')
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // Insights' own rules still paint from the palette Overclock gives it
      await expect(root).toHaveCSS('--ui', '#0d1416')
      // and so do its newer ones, from its own tokens, and its calendars,
      // whose empty days sit in the field
      await expect(root).toHaveCSS('--sx-ui', '#070b0c')
      await expect(root).toHaveCSS('--ins-o4', '#4a8dff')
      await expect(root.locator('.ins-sub').first()).toHaveCSS(
        'color',
        'rgb(134, 153, 154)',
      )
      await expect(root.locator('.ins-card').first()).toHaveCSS(
        'background-color',
        'rgb(13, 20, 22)',
      )
      await expect(root.locator('.ins-tab.on')).toHaveCSS(
        'color',
        'rgb(243, 230, 0)',
      )
      await expect(root.locator('.ins-title')).toHaveCSS(
        'font-family',
        /Overclock Chakra/,
      )
      await root
        .locator('.ins-bar[data-tip]')
        .filter({ visible: true })
        .first()
        .hover()
      const tip = page.locator('#ins-tip')
      await expect(tip).toBeVisible()
      await expect(tip).toHaveCSS('background-color', 'rgb(243, 230, 0)')
      await expect(tip).toHaveCSS('color', 'rgb(10, 10, 12)')
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
        /\boverclock-restyle-insights\b/,
      )
      // Turned on in Settings › Plugins, then on to Stats with no reload
      await switchSetting(page, 'restyleInsights', true)
      await page
        .locator('a[href="/stats"]')
        .filter({ visible: true })
        .first()
        .click()
      await expect(page.locator('html')).toHaveClass(
        /\boverclock-restyle-insights\b/,
      )
      // Kept for the next visit, so Stats never opens in Insights' colours
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('overclock.restyle')).insights,
        ),
      ).toBe(true)
    } finally {
      await setPlugin({})
    }
  })

  test("the What works sidebar clears Overclock's navbar", async ({ page }) => {
    await setPlugin({})
    await openInsights(page, 'you')
    await expect(page.locator('#insights .ins-side')).toHaveCSS(
      'top',
      '69.25px',
    )
  })

  // The Insights classes in overclock.css that no tab renders on the demo
  // library, against the ones that matched nothing on the pinned Insights
  // (plugins/overclock/tests/insights-unmatched-baseline.txt). A class that
  // newly matches nothing is one an Insights release renamed or removed.
  test('every Insights class Overclock styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-Overclock/overclock.css',
        folder: 'overclock',
        plugin: 'insights',
      }),
    ).toEqual([])
  })
})

test.describe('beside Performers Toolkit', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyOverclock()
  })

  // As Insights, from 0.13 (in <style id="performerstoolkit-sx">)
  test("Performers Toolkit takes Overclock's colours by itself until the restyle is on", async ({
    page,
  }) => {
    await setPlugin({})
    await openPerformersToolkit(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\boverclock-restyle-toolkit\b/,
    )
    await expect(page.locator('style#performerstoolkit-sx')).toHaveCount(1)
    await expect(page.locator('.pt')).toHaveCSS(
      'background-color',
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    )
  })

  test('the restyle puts Performers Toolkit on the display', async ({
    page,
  }) => {
    try {
      await setPlugin({ restylePerformersToolkit: true })
      await openPerformersToolkit(page, 'find')
      await expect(page.locator('html')).toHaveClass(
        /\boverclock-restyle-toolkit\b/,
      )
      const root = page.locator('.pt')
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // The toolkit's own rules still paint from the palette Overclock
      // gives it
      await expect(root).toHaveCSS('--ui', '#0d1416')
      await expect(root.locator('.pt-card').first()).toHaveCSS(
        'background-color',
        'rgb(13, 20, 22)',
      )
      await expect(root.locator('.pt-tab.on')).toHaveCSS(
        'color',
        'rgb(243, 230, 0)',
      )
      await expect(root.locator('.pt-btn.pt-pri').first()).toHaveCSS(
        'background-color',
        'rgb(243, 230, 0)',
      )
      // On a performer's page, the Stats tab and the strip under the name
      // (read at each try: the toolkit draws the tab anew as each of its
      // lookups returns, and the one it just replaced reads empty)
      const ids = await demoIds()
      await openPerformerStats(page, ids.performer)
      await expect(page.locator('.ptc')).toHaveCSS('--ui', '#0d1416')
      await expect(page.locator('.ptc')).toHaveCSS('--sx-ui', '#0d1416')
      await expect(page.locator('.ptc .pt-kpi').first()).toHaveCSS(
        'background-color',
        'rgb(13, 20, 22)',
      )
      await expect(page.locator('#pt-strip')).toHaveCSS(
        'font-family',
        /Overclock Mono/,
      )
    } finally {
      await setPlugin({})
    }
  })

  // From 0.22 the toolkit seats the rating beside the name in the header
  // it tidies, where the chevrons covered the Locked tag and the O counter
  // ran under the side panel. The rating keeps its row under the name, with
  // the restyle off and on.
  for (const restylePerformersToolkit of [false, true]) {
    test(`the rating keeps its row under the name, with the restyle ${restylePerformersToolkit ? 'on' : 'off'}`, async ({
      page,
    }) => {
      try {
        await setPlugin({ restylePerformersToolkit })
        await page.goto(url('/performers/:performer'))
        const head = page.locator(
          '#performer-page .performer-head[data-pt-tidy]',
        )
        await head.waitFor({ timeout: 30_000 })
        await page.locator('#pt-side').waitFor()
        const name = await head.locator('> h2').boundingBox()
        const rating = head.locator('> .quality-group')
        const side = await page.locator('#pt-side').boundingBox()
        expect((await rating.boundingBox()).y).toBeGreaterThanOrEqual(
          name.y + name.height - 1,
        )
        const right = await rating.evaluate((el) =>
          Math.max(
            ...[...el.querySelectorAll('*')].map(
              (child) => child.getBoundingClientRect().right,
            ),
          ),
        )
        expect(right).toBeLessThan(side.x)
      } finally {
        await setPlugin({})
      }
    })
  }

  // The Catalog tab's count is a Stash badge in a Stash tab, which also
  // carries Performers Toolkit's badge class and its near-black type. It
  // shows once a stash-box has answered, which the mock stash-box does not,
  // so the test shows it, with the restyle off and on.
  for (const restylePerformersToolkit of [false, true]) {
    test(`the Catalog tab's count reads, closed and open, with the restyle ${restylePerformersToolkit ? 'on' : 'off'}`, async ({
      page,
    }) => {
      try {
        await setPlugin({ restylePerformersToolkit })
        await openPerformerStats(page, (await demoIds()).performer)
        const tab = page.locator('.pt-tablink[data-pt-tab="catalog"]')
        const badge = tab.locator('.badge')
        const reads = async () => {
          await badge.evaluate((el) => {
            el.hidden = false
            el.textContent = '12'
          })
          const { color, background } = await badge.evaluate((el) => {
            const style = getComputedStyle(el)
            return { color: style.color, background: style.backgroundColor }
          })
          expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
        }
        await reads()
        await tab.click()
        await expect(
          page.locator('.pt-tablink[data-pt-tab="catalog"].active'),
        ).toBeAttached()
        await reads()
      } finally {
        await setPlugin({})
      }
    })
  }

  // As for Insights, against
  // plugins/overclock/tests/performerstoolkit-unmatched-baseline.txt
  test('every Performers Toolkit class Overclock styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-Overclock/overclock.css',
        folder: 'overclock',
        plugin: 'performerstoolkit',
      }),
    ).toEqual([])
  })
})

// Each restyle setting shows in Settings > Plugins only while its plugin
// is on, since it has nothing to restyle otherwise. Overclock hides its row
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
    await onlyOverclock()
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
