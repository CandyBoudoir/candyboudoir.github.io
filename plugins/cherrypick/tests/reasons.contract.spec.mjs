// Reasons on cards (the reasonDisplay setting): Text puts the reason under
// each card in Cherry Pick's rows; Icon puts an icon on For you's covers
// that shows the reason on hover or tap, with no line on the other rows;
// Off shows no reason. Settings › Plugins draws it as a drop-down
// (features/settingsExtras.jsx, ui/rowCards.jsx, ui/ReasonIcon.jsx).
import { expect, test } from '@playwright/test'
import { companionPluginIds } from '../../../tests/stash/companions.mjs'
import {
  PLUGIN_ID,
  demoScene,
  forYouCards,
  pluginConfig,
  setPluginSettings,
  setUpCherryPick,
  tearDownCherryPick,
} from './stash.mjs'

let demo
test.beforeAll(async () => {
  ;({ demo } = await setUpCherryPick())
})
test.afterAll(tearDownCherryPick)

const ICONS = ['trend', 'seedling', 'clock', 'cherries', 'flask']
const companions = companionPluginIds()

const front = (page) => page.locator('.cherrypick-front')
const tab = (page) => page.locator('.cherrypick-fy-list')
const tabCards = (page) => tab(page).locator('.scene-card')
const popover = (page) => page.locator('.cherrypick-reason-popover')

// Runs body with Reasons on cards set to value, as Stash's Settings page
// saves it, and puts the configuration back after
async function withDisplay(value, body) {
  const before = await pluginConfig()
  await setPluginSettings(PLUGIN_ID, { ...before, reasonDisplay: value })
  try {
    await body()
  } finally {
    await setPluginSettings(PLUGIN_ID, before)
  }
}

// Other plugins draw their badges a moment after the card: wait for them
// before checking the corner
async function companionBadges(cards) {
  const badge = companions.includes('xenith')
    ? '.hon-compact-badge'
    : companions.includes('ascension')
      ? '.hon-asc-score-display'
      : null
  if (badge)
    await expect(cards.first().locator(badge)).toBeVisible({ timeout: 20_000 })
}

// Each card's icon against the pieces Stash and other plugins put on the
// cover: the ones it overlaps, by card, once transitions end
// (Refract lays the title and its performers over the foot of the picture)
const CORNER =
  '.scene-interactive-speed-overlay, .scene-specs-overlay, .studio-overlay, .rating-banner, .progress-bar, .card-section-title, .cherrypick-score-chip, .hon-compact-badge, .hon-asc-score-display, .curator-scene-card-badge, .stash-performer-avatars, .stash-card-counts > :not(.cherrypick-reason-pill)'
const crowded = (cards) =>
  cards.evaluateAll(async (els, corner) => {
    await Promise.all(
      els
        .flatMap((el) => [...el.querySelectorAll('*')])
        .flatMap((el) => el.getAnimations())
        .filter((a) => a instanceof CSSTransition)
        .map((a) => a.finished.catch(() => {})),
    )
    // Stash sets both left and right on the speed overlay, so its box
    // spans the cover: its number is what takes the corner
    const box = (el) => {
      const words = document.createRange()
      words.selectNodeContents(el)
      const b = el.matches('.scene-interactive-speed-overlay')
        ? words.getBoundingClientRect()
        : el.getBoundingClientRect()
      return b.width && b.height && getComputedStyle(el).visibility !== 'hidden'
        ? b
        : null
    }
    const hit = (a, b) =>
      a.left < b.right &&
      b.left < a.right &&
      a.top < b.bottom &&
      b.top < a.bottom
    return els.flatMap((card) => {
      const icon = box(card.querySelector('.cherrypick-reason-icon'))
      if (!icon) return []
      return [...card.querySelectorAll(corner)]
        .filter((el) => getComputedStyle(el).opacity !== '0')
        .map((el) => [el.className, box(el)])
        .filter(([, b]) => b && hit(icon, b))
        .map(([cls]) => cls)
    })
  }, CORNER)

// The icon's place on its cover: from the cover's left and bottom edges,
// and its hit area's size
const placeOf = (card) =>
  card.evaluate((el) => {
    const cover = el.querySelector('.thumbnail-section').getBoundingClientRect()
    const icon = el
      .querySelector('.cherrypick-reason-icon')
      .getBoundingClientRect()
    const button = el.querySelector('.cherrypick-reason-icon')
    return {
      left: icon.left - cover.left,
      bottom: cover.bottom - icon.bottom,
      width: icon.width,
      height: icon.height,
      inLink: !!button.closest('a'),
      inPills: !!button.closest('.stash-card-counts'),
    }
  })

// Whether Stash's hover preview is showing on the card (it moves the video
// over the picture on a hovered card)
const previewShown = (card) =>
  card
    .locator('.scene-card-preview-video')
    .evaluate((v) => getComputedStyle(v).top !== '-9999px')

test('Text: the reason is a line under each card, and no cover has an icon', async ({
  page,
}) => {
  await page.goto('/')
  await expect(forYouCards(page)).toHaveCount(12, { timeout: 20_000 })
  await expect(
    page.locator('.cherrypick-for-you .slick-slide .cherrypick-reason'),
  ).toHaveCount(12)
  await expect(page.locator('.cherrypick-reason-icon')).toHaveCount(0)
  // the rows that follow your watching keep theirs
  const follow = page.locator('.cherrypick-follow').first()
  await expect(follow).toBeVisible({ timeout: 20_000 })
  await expect(follow.locator('.cherrypick-reason').first()).not.toBeEmpty()
})

test("Icon: For you's covers show the reason's icon, other rows show no reason", async ({
  page,
}) => {
  await withDisplay('icon', async () => {
    await page.goto('/')
    await expect(forYouCards(page)).toHaveCount(12, { timeout: 20_000 })
    const icons = page.locator(
      '.cherrypick-for-you .slick-slide .cherrypick-reason-icon',
    )
    await expect(icons).toHaveCount(12)
    // one of the five, named by its reason
    for (const icon of await icons.all()) {
      expect(ICONS).toContain(await icon.getAttribute('data-icon'))
      expect(await icon.getAttribute('aria-label')).toMatch(/^[A-Z].{8,}/)
    }
    // no line on any of Cherry Pick's front-page cards, and nothing on
    // Stash's own rows
    await expect(page.locator('.cherrypick-follow').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(front(page).locator('.cherrypick-reason')).toHaveCount(0)
    await expect(
      page.locator('.cherrypick-follow .cherrypick-reason-icon'),
    ).toHaveCount(0)
    await expect(
      page.locator(
        '.recommendations-container:not(.cherrypick-front) .cherrypick-reason-icon',
      ),
    ).toHaveCount(0)

    // At the bottom left of the cover, outside the card's link, with room
    // for a finger, and apart from everything else on the cover. Under
    // Refract, the first of the pills Refract lays over the picture.
    const card = forYouCards(page).first()
    const place = await placeOf(card)
    expect(place.inLink).toBe(false)
    if (companions.includes('refract')) expect(place.inPills).toBe(true)
    else {
      expect(place.left).toBeLessThan(16)
      expect(place.bottom).toBeGreaterThan(9)
      expect(place.width).toBeGreaterThanOrEqual(30)
      expect(place.height).toBeGreaterThanOrEqual(30)
    }
    await companionBadges(forYouCards(page))
    expect(await crowded(forYouCards(page))).toEqual([])

    // Pointing at it shows the whole reason, keeps the cover's preview
    // hidden, and moving away hides the reason
    const icon = card.locator('.cherrypick-reason-icon')
    const reason = await icon.getAttribute('aria-label')
    await icon.hover({ force: companions.includes('refract') })
    await expect(popover(page)).toHaveText(reason)
    expect(await previewShown(card)).toBe(false)
    await page.mouse.move(5, 5)
    await expect(popover(page)).toHaveCount(0)
  })
})

test('Icon: the icon goes above the speed of an interactive scene', async ({
  page,
}) => {
  // Stash shows a funscript's speed at the bottom left of the cover: the
  // demo library's scenes have none, so each scene of Cherry Pick's rows
  // gets one
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON()
    if (
      body?.operationName !== 'FindScenes' ||
      !Array.isArray(body.variables?.scene_ids)
    )
      return route.fallback()
    const response = await route.fetch()
    const json = await response.json()
    for (const s of json.data?.findScenes?.scenes ?? [])
      s.interactive_speed = 142
    return route.fulfill({ response, json })
  })
  await withDisplay('icon', async () => {
    await page.goto('/')
    await expect(forYouCards(page)).toHaveCount(12, { timeout: 20_000 })
    const card = forYouCards(page).first()
    const speed = card.locator('.scene-interactive-speed-overlay')
    await expect(speed).toHaveText('142')
    await companionBadges(forYouCards(page))
    expect(await crowded(forYouCards(page))).toEqual([])
    // Under Refract the icon is one of Refract's pills, apart from the
    // number as checked above
    if (companions.includes('refract')) return
    const [icon, number] = await Promise.all([
      card.locator('.cherrypick-reason-icon').boundingBox(),
      speed.boundingBox(),
    ])
    expect(icon.y + icon.height).toBeLessThanOrEqual(number.y + 1)
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('Icon: a tap shows the reason and opens nothing; a tap elsewhere hides it', async ({
    page,
  }) => {
    await withDisplay('icon', async () => {
      await page.goto('/')
      await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
      const card = page
        .locator('.cherrypick-for-you .slick-slide.slick-active .scene-card')
        .first()
      const icon = card.locator('.cherrypick-reason-icon')
      const reason = await icon.getAttribute('aria-label')
      await icon.tap({ force: companions.includes('refract') })
      await expect(popover(page)).toHaveText(reason)
      // still on the front page, the cover still, and no click through:
      // For you counts one only on the card's links
      await page.waitForTimeout(500)
      expect(new URL(page.url()).pathname).toBe('/')
      expect(await previewShown(card)).toBe(false)
      expect((await placeOf(card)).inLink).toBe(false)
      // A second tap hides it, and so does one anywhere else
      await icon.tap({ force: companions.includes('refract') })
      await expect(popover(page)).toHaveCount(0)
      await icon.tap({ force: companions.includes('refract') })
      await expect(popover(page)).toHaveText(reason)
      await page
        .locator('.cherrypick-for-you .recommendation-row-head h2')
        .tap()
      await expect(popover(page)).toHaveCount(0)
      expect(new URL(page.url()).pathname).toBe('/')
    })
  })
})

test("Icon: For you's tab shows icons in Grid, varied over the page, and none in List or Wall", async ({
  page,
}) => {
  await withDisplay('icon', async () => {
    await page.goto('/plugins/cherrypick?disp=0&per=40')
    await expect(tabCards(page)).toHaveCount(40, { timeout: 20_000 })
    const icons = tab(page).locator('.cherrypick-reason-icon')
    await expect(icons).toHaveCount(40)
    await expect(tab(page).locator('.cherrypick-reason')).toHaveCount(0)
    // the row's variety rule over the page: no sentence on more than two
    // cards, so the page has more than one icon
    const labels = await icons.evaluateAll((els) =>
      els.map((el) => [el.getAttribute('aria-label'), el.dataset.icon]),
    )
    const count = (i) =>
      labels.reduce((m, l) => m.set(l[i], (m.get(l[i]) || 0) + 1), new Map())
    for (const [text, n] of count(0))
      expect(n, `"${text}" on ${n} cards`).toBeLessThanOrEqual(2)
    expect(count(1).size).toBeGreaterThan(1)
    if (companions.includes('stash-curator'))
      await expect(
        tabCards(page).first().locator('.curator-scene-card-badge'),
      ).toBeVisible({ timeout: 20_000 })
    await companionBadges(tabCards(page))
    expect(await crowded(tabCards(page))).toEqual([])
    // A click shows the reason and leaves the tab where it is
    const icon = icons.first()
    await icon.click({ force: companions.includes('refract') })
    await expect(popover(page)).toHaveText(
      await icon.getAttribute('aria-label'),
    )
    expect(new URL(page.url()).pathname).toBe('/plugins/cherrypick')
    expect(new URL(page.url()).searchParams.has('qs')).toBe(false)

    for (const disp of [1, 2]) {
      await page.goto(`/plugins/cherrypick?disp=${disp}&per=40`)
      await expect(
        tab(page)
          .locator(disp === 1 ? 'tbody tr' : '.wall-item')
          .first(),
      ).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('.cherrypick-reason-icon')).toHaveCount(0)
    }
  })
})

test('Off: no reason on any Cherry Pick card, and the scene page keeps its line', async ({
  page,
}) => {
  await withDisplay('off', async () => {
    await page.goto('/')
    await expect(forYouCards(page)).toHaveCount(12, { timeout: 20_000 })
    await expect(page.locator('.cherrypick-follow').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page.locator('.cherrypick-reason, .cherrypick-reason-icon'),
    ).toHaveCount(0)
    // nor Stash's description in its place
    await expect(
      front(page).locator('.scene-card__description').filter({ visible: true }),
    ).toHaveCount(0)

    await page.goto('/plugins/cherrypick')
    await expect(tabCards(page).first()).toBeVisible({ timeout: 20_000 })
    await expect(
      page.locator('.cherrypick-reason, .cherrypick-reason-icon'),
    ).toHaveCount(0)
    await expect(
      tab(page).locator('.scene-card__description').filter({ visible: true }),
    ).toHaveCount(0)

    const unrated = demoScene(demo, { rated: false, played: true })
    await page.goto(`/scenes/${unrated}`)
    await expect(
      page.locator('.scene-toolbar .cherrypick-line-button').first(),
    ).toHaveText(/^likely .* for you$/, { timeout: 20_000 })
    const more = page.locator('.cherrypick-more-like-this')
    await expect(more.locator('.scene-card').first()).toBeAttached({
      timeout: 20_000,
    })
    await expect(
      page.locator('.cherrypick-reason, .cherrypick-reason-icon'),
    ).toHaveCount(0)
  })
})

test('Settings › Plugins shows Reasons on cards as a drop-down that saves', async ({
  page,
}) => {
  const before = await pluginConfig()
  try {
    // Cherry Pick's first-load defaults in Stash before the Settings page
    // takes its copy
    await page.goto('/')
    await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
    await expect
      .poll(async () => (await pluginConfig())?.showForYou, { timeout: 20_000 })
      .toBe(true)
    await page.goto('/settings?tab=plugins')
    const row = page.locator('#plugin-CherryPick-reasonDisplay')
    await expect(row).toBeAttached({ timeout: 20_000 })
    // develop collapses each plugin's settings until its heading is clicked
    if (await row.isHidden())
      await page
        .locator('.setting-group', { has: row })
        .locator(':scope > .setting')
        .click()
    await expect(row).toBeVisible()
    await expect(row.locator('h3')).toHaveText('Reasons on cards')
    const select = row.locator('select')
    await expect(select).toHaveValue('text')
    await expect(select.locator('option')).toHaveText(['Text', 'Icon', 'Off'])
    // in place of Stash's text box, once, among the switches in the
    // manifest's order
    await expect(row.locator('button')).toHaveCount(0)
    await expect(page.locator('#plugin-CherryPick-reasonDisplay')).toHaveCount(
      1,
    )
    const order = await page.evaluate(() =>
      // a switch's id is on its input, a drop-down's on its row
      ['outOfLibrary', 'reasonDisplay', 'badges'].map((k) => {
        const el = document
          .getElementById(`plugin-CherryPick-${k}`)
          ?.closest('.setting')
        return el ? [...el.parentNode.children].indexOf(el) : -1
      }),
    )
    expect(order[0]).toBeGreaterThanOrEqual(0)
    expect(order[1]).toBe(order[0] + 1)
    expect(order[2]).toBe(order[1] + 1)

    await select.selectOption('icon')
    await expect
      .poll(async () => (await pluginConfig())?.reasonDisplay, {
        timeout: 10_000,
      })
      .toBe('icon')
    // the switches keep their values
    expect((await pluginConfig()).showForYou).toBe(true)
    await page.goto('/')
    await expect(
      page.locator('.cherrypick-for-you .slick-slide .cherrypick-reason-icon'),
    ).toHaveCount(12, { timeout: 20_000 })
  } finally {
    await setPluginSettings(PLUGIN_ID, before)
  }
})
