// Checks that Stash still renders the elements Juicy styles and that Juicy's
// CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import {
  CHEEKY_EMPTY_LINE,
  EMPTY_LIST,
  FLOWS,
  PAGES,
  PLUGIN_ID,
  demoIds,
  demoPath,
  onlyJuicy,
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

// Stash puts Bootstrap's !important bg-secondary and text-white on the list
// toolbars' Sort by and more menus, a scene's Operations menu and every item
// in them, which once left those menus slate. Each opens on Juicy's plum
// panel, and its items hover pink like every other menu's.
const SLATE_MENUS = [
  ...['scenes', 'performers', 'images', 'galleries', 'studios', 'tags'].flatMap(
    (list) => [
      [
        `the ${list} list's Sort by menu`,
        `/${list}`,
        '.sort-by-select .dropdown-toggle',
      ],
      [`the ${list} list's more menu`, `/${list}`, '#more-menu'],
    ],
  ),
  ["a scene's Operations menu", '/scenes/:scene', '#operation-menu'],
]

for (const [name, path, toggle] of SLATE_MENUS) {
  test(`${name} opens plum and hovers pink`, async ({ page }) => {
    await page.goto(url(path))
    await page.locator(toggle).click()
    const menu = page.locator('.dropdown-menu.show')
    await expect(menu).toHaveCSS('background-color', 'rgb(45, 24, 82)')
    const item = menu
      .locator('.dropdown-item')
      .filter({ visible: true })
      .first()
    await expect(item).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(item).toHaveCSS('color', 'rgb(255, 242, 250)')
    await item.hover()
    await expect(item).toHaveCSS('background-color', 'rgba(252, 61, 159, 0.16)')
    await expect(item).toHaveCSS('color', 'rgb(252, 104, 178)')
  })
}

// Stash marks the picked button of a group with Bootstrap's .active alone: the
// display mode in every list toolbar, the page number when a list has fewer
// than four pages, and Overwrite, Add or Remove in a bulk edit. Juicy presses
// it in, pink among plum or magenta among pink, where it once matched the rest.
const PINK = 'rgb(252, 61, 159)'
const PLUM = 'rgb(45, 24, 82)'
const MAGENTA = 'rgb(221, 42, 151)'
const INK = 'rgb(1, 2, 36)'

async function expectPicked(group, picked, rest) {
  const active = group.locator('> .btn.active')
  await expect(active).toHaveCount(1)
  await expect(active).toHaveCSS('background-color', picked)
  await expect(active).toHaveCSS('color', INK)
  await expect(active).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 2)')
  const other = group.locator('> .btn:not(.active, :disabled)').first()
  await expect(other).toHaveCSS('background-color', rest)
  await expect(other).toHaveCSS('transform', 'none')
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } })
    for (const list of ['scenes', 'performers']) {
      test(`the ${list} list's display mode shows which is picked`, async ({
        page,
      }) => {
        await page.goto(`/${list}`)
        const group = page
          .locator('.filtered-list-toolbar .btn-group')
          .filter({ has: page.locator('> .btn.active') })
        await expectPicked(group, PINK, PLUM)
      })
    }
  })
}

test("a short list's page numbers show the current page", async ({ page }) => {
  await page.goto('/scenes?perPage=3')
  const pages = page.locator('.pagination.btn-group').first()
  await expect(pages.locator('> .btn.active')).toHaveText('1')
  await expectPicked(pages, PINK, PLUM)
})

test("a bulk edit's Overwrite, Add and Remove show which is picked", async ({
  page,
}) => {
  await page.goto('/scenes')
  await page.locator('.scene-card .card-check').first().check()
  await page
    .locator('.filtered-list-toolbar button:has(svg[data-icon="pencil"])')
    .click()
  const modes = page.locator('.modal .multi-set .btn-group').first()
  await expectPicked(modes, MAGENTA, PINK)
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

// Insights, another author's stats dashboard on the Stats page (RESTYLED in
// tests/stash/companions.mjs), takes Juicy's colours by itself, and with
// Restyle Insights on takes Juicy's palette, stickers and type. Its sidebar
// clears Juicy's pink rule either way.
test.describe('beside Insights', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'Insights')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyJuicy()
  })

  // Insights 2.12 and later work out their colours from the page (in
  // <style id="insights-sx">), so before the restyle is on Insights already
  // sits on Juicy's page in Juicy's colours
  test("Insights takes Juicy's colours by itself until the restyle is on", async ({
    page,
  }) => {
    await setPlugin({})
    await openInsights(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\bjuicy-restyle-insights\b/,
    )
    await expect(page.locator('style#insights-sx')).toHaveCount(1)
    await expect(page.locator('#insights')).toHaveCSS(
      'background-color',
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    )
  })

  test('the restyle puts Insights in the candy', async ({ page }) => {
    try {
      await setPlugin({ restyleInsights: true })
      await openInsights(page, 'library')
      await expect(page.locator('html')).toHaveClass(
        /\bjuicy-restyle-insights\b/,
      )
      const root = page.locator('#insights')
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // Insights' own rules still paint from the palette Juicy gives it
      await expect(root).toHaveCSS('--ui', '#22123f')
      // and so do its newer ones, from its own tokens, and its calendars,
      // whose empty days sit in the well
      for (const [name, value] of [
        ['--sx-ui', '#0d0520'],
        ['--ins-o4', '#fc68b2'],
      ])
        await expect(root).toHaveCSS(name, value)
      await expect(root.locator('.ins-sub').first()).toHaveCSS(
        'color',
        'rgb(149, 124, 176)',
      )
      await expect(root.locator('.ins-card').first()).toHaveCSS(
        'border-radius',
        '20px',
      )
      await expect(root.locator('.ins-title')).toHaveCSS(
        'font-family',
        /Juicy Fredoka/,
      )
      await root
        .locator('.ins-bar[data-tip]')
        .filter({ visible: true })
        .first()
        .hover()
      const tip = page.locator('#ins-tip')
      await expect(tip).toBeVisible()
      await expect(tip).toHaveCSS('background-color', 'rgb(1, 2, 36)')
      await expect(tip).toHaveCSS('color', 'rgb(215, 250, 84)')
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
        /\bjuicy-restyle-insights\b/,
      )
      await setPlugin({ restyleInsights: true })
      await page
        .locator('a[href="/stats"]')
        .filter({ visible: true })
        .first()
        .click()
      await expect(page.locator('html')).toHaveClass(
        /\bjuicy-restyle-insights\b/,
      )
      // Kept for the next visit, so Stats never opens in Insights' colours
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('juicy.restyle')).insights,
        ),
      ).toBe(true)
    } finally {
      await setPlugin({})
    }
  })

  test("the What works sidebar clears Juicy's pink rule", async ({ page }) => {
    await setPlugin({})
    await openInsights(page, 'you')
    await expect(page.locator('#insights .ins-side')).toHaveCSS('top', '63px')
  })

  // The Insights classes in juicy.css that no tab renders on the demo
  // library, against the ones that matched nothing on the pinned Insights
  // (plugins/juicy/tests/insights-unmatched-baseline.txt). A class that newly
  // matches nothing is one an Insights release renamed or removed.
  test('every Insights class Juicy styles still renders', async ({ page }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-Juicy/juicy.css',
        folder: 'juicy',
        plugin: 'insights',
      }),
    ).toEqual([])
  })
})

// Performers Toolkit, from the same author and in the same look as
// Insights, has a setting of its own: with Restyle Performers Toolkit on, its
// page, the Stats tab it adds to a performer's page and its toast take
// Juicy's palette, stickers and type.
test.describe('beside Performers Toolkit', () => {
  test.beforeAll(async () => {
    await usePlugins(PLUGIN_ID, 'PerformersToolkit')
  })
  test.afterAll(async () => {
    await setPlugin({})
    await onlyJuicy()
  })

  // As Insights, from 0.13 (in <style id="performerstoolkit-sx">)
  test("Performers Toolkit takes Juicy's colours by itself until the restyle is on", async ({
    page,
  }) => {
    await setPlugin({})
    await openPerformersToolkit(page)
    await expect(page.locator('html')).not.toHaveClass(
      /\bjuicy-restyle-toolkit\b/,
    )
    await expect(page.locator('style#performerstoolkit-sx')).toHaveCount(1)
    await expect(page.locator('.pt').first()).toHaveCSS(
      'background-color',
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    )
  })

  test('the restyle puts Performers Toolkit in the candy', async ({ page }) => {
    try {
      await setPlugin({ restylePerformersToolkit: true })
      await openPerformersToolkit(page)
      await expect(page.locator('html')).toHaveClass(
        /\bjuicy-restyle-toolkit\b/,
      )
      const root = page.locator('.pt').first()
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(root.locator('.pt-title')).toHaveCSS(
        'font-family',
        /Juicy Fredoka/,
      )
      await expect(root.locator('.pt-card').first()).toHaveCSS(
        'border-radius',
        '20px',
      )
      await openPerformerStats(page, ids.performer)
      const stats = page.locator('.ptc').first()
      // Its own rules still paint from the palette Juicy gives it
      // (read at each try: the toolkit draws the tab anew as each of its
      // lookups returns, and the one it just replaced reads empty)
      await expect(stats).toHaveCSS('--ui', '#22123f')
      await expect(stats).toHaveCSS('--sx-ui', '#22123f')
      await expect(stats.locator('.pt-kpi').first()).toHaveCSS(
        'background-color',
        'rgb(34, 18, 63)',
      )
    } finally {
      await setPlugin({})
    }
  })

  // The Catalog tab's count is a Stash badge in a Stash tab, which also
  // carries Performers Toolkit's badge class. It shows once a stash-box has
  // answered, which the mock stash-box does not, so the test shows it. It
  // reads as Juicy's purple tag chip with the setting on or off.
  for (const restylePerformersToolkit of [false, true]) {
    test(`the Catalog tab's count reads, closed and open, restyle ${
      restylePerformersToolkit ? 'on' : 'off'
    }`, async ({ page }) => {
      try {
        await setPlugin({ restylePerformersToolkit })
        await openPerformerStats(page, ids.performer)
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
  // plugins/juicy/tests/performerstoolkit-unmatched-baseline.txt
  test('every Performers Toolkit class Juicy styles still renders', async ({
    page,
  }) => {
    expect(
      await unmatchedRestyledClasses(page, {
        css: 'dist/site/Theme-Juicy/juicy.css',
        folder: 'juicy',
        plugin: 'performerstoolkit',
      }),
    ).toEqual([])
  })
})

// Each restyle setting shows in Settings > Plugins only while its plugin
// is on, since it has nothing to restyle otherwise. Juicy hides its row with
// display: none; the row's section may be collapsed (Stash develop starts
// plugin settings closed), so the test reads the row's display.
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
    await onlyJuicy()
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
