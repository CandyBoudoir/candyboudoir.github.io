// Checks that Cherry Pick's pieces render in Stash's pages, on the seams
// docs/stash-seams.md lists, and that what it stores reaches Stash.
import { expect, test } from '@playwright/test'
import { companionPluginIds } from '../../../tests/stash/companions.mjs'
import {
  DEMO,
  PLUGIN_ID,
  demoScene,
  finishedBracket,
  forYouCards,
  gql,
  pluginConfig,
  setPluginSettings,
  setUpCherryPick,
  tearDownCherryPick,
} from './stash.mjs'

let shared
let demo
test.beforeAll(async () => {
  ;({ shared, demo } = await setUpCherryPick())
})
test.afterAll(tearDownCherryPick)

test('For you comes first on the front page, before Stash rows', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  expect(await forYouCards(page).count()).toBe(12)
  // Every card says why it is there, in place of its description.
  await expect(
    page.locator('.cherrypick-for-you .cherrypick-reason').first(),
  ).not.toBeEmpty()
  // Stash's own rows and Customise button are still there, after Cherry Pick's.
  const order = await page.evaluate(() => {
    const ours = document.querySelector('.cherrypick-front')
    const stash = document.querySelector(
      '.recommendations-container:not(.cherrypick-front)',
    )
    return {
      before: !!(
        ours &&
        stash &&
        ours.compareDocumentPosition(stash) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      customise: !!stash?.querySelector('.recommendations-footer .btn'),
    }
  })
  expect(order).toEqual({ before: true, customise: true })
  expect(errors).toEqual([])
})

// Cherry Pick's rows ask Stash for their scenes by id (Stash's own
// FindScenes with scene_ids), and Stash fails the whole request if one id
// is gone: a scene deleted or merged since Cherry Pick read the library.
// This adds an id no scene has to each request for more than one scene.
const sceneByIds = (route) => {
  const body = route.request().postDataJSON()
  return body?.operationName === 'FindScenes' &&
    Array.isArray(body.variables?.scene_ids)
    ? body
    : null
}

test('For you keeps its cards when Stash has lost one of its scenes', async ({
  page,
}) => {
  await page.route('**/graphql', (route) => {
    const body = sceneByIds(route)
    const ids = body?.variables.scene_ids
    if (!ids || ids.length < 2) return route.continue()
    return route.continue({
      postData: JSON.stringify({
        ...body,
        variables: { ...body.variables, scene_ids: [...ids, 999999] },
      }),
    })
  })
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  expect(await forYouCards(page).count()).toBe(12)
})

test('For you says so when Stash sends none of its scenes', async ({
  page,
}) => {
  await page.route('**/graphql', (route) =>
    sceneByIds(route)
      ? route.fulfill({
          json: { errors: [{ message: 'scene with id 1 not found' }] },
        })
      : route.continue(),
  )
  await page.goto('/')
  await expect(
    page.locator('.cherrypick-for-you .cherrypick-row-empty'),
  ).toHaveText(
    "Stash didn't send these scenes. Reload the page to try again.",
    {
      timeout: 20_000,
    },
  )
})

// A champion merged into another performer, or deleted, stays in the
// bracket history Cherry Pick keeps.
test('the Hall of Fame keeps its champions when Stash has lost one', async ({
  page,
}) => {
  const before = (await pluginConfig()) ?? {}
  const gone = { ...finishedBracket('999999', null), id: 'bgone' }
  await setPluginSettings(PLUGIN_ID, {
    ...before,
    hallOfFame: JSON.stringify([
      finishedBracket(demo.performers['Bea Lark'], null),
      gone,
    ]),
  })
  try {
    await page.goto('/')
    const cards = page.locator(
      '.cherrypick-row-hall-of-fame .slick-slide:not(.slick-cloned) .performer-card',
    )
    await expect(cards.first()).toBeVisible({ timeout: 20_000 })
    expect(await cards.count()).toBe(1)
  } finally {
    // no page left open to save over the configuration put back
    await page.close()
    await setPluginSettings(PLUGIN_ID, before)
  }
})

// Stash stretches every card in a row to the tallest one, with the popover
// row at its foot, whatever each card's description holds.
test("the cards in Cherry Pick's rows end at the same height, as in Stash's rows", async ({
  page,
}) => {
  // One card's details grow taller, as a reason that wraps to two lines does
  const check = async (row) => {
    await page.addStyleTag({
      content: `${row} .slick-slide[data-index="1"] .scene-card__details { padding-bottom: 3rem; }`,
    })
    // offsetHeight, the height before transforms: Refract floats its cards
    // rated 4.75★ and up, up to 6% larger, in Stash's rows as in these
    const heights = await page
      .locator(`${row} .slick-slide:not(.slick-cloned) .scene-card`)
      .evaluateAll((cards) => [...new Set(cards.map((c) => c.offsetHeight))])
    expect(heights, row).toHaveLength(1)
  }
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  await check('.cherrypick-for-you')
  await page.goto(`/scenes/${demoScene(demo, { rated: false, played: true })}`)
  await expect(
    page.locator('.cherrypick-mlt-owned .scene-card').first(),
  ).toBeVisible({ timeout: 20_000 })
  await check('.cherrypick-mlt-owned')
})

// Each page of the library takes a second and a half to arrive, as on a
// library of tens of thousands of scenes, so the first build lasts long
// enough to watch.
const slowLibrary = (page) =>
  page.route('**/graphql', async (route) => {
    if (/CherryPick(Scenes|Performers)/.test(route.request().postData() || ''))
      await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })

test("a browser's first visit says For you is reading the library; a reload doesn't", async ({
  page,
}) => {
  // Whether the line showed at any moment of a page load
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('.cherrypick-building'))
        window.__sawBuilding = true
    }).observe(document, { childList: true, subtree: true })
  })
  await slowLibrary(page)
  await page.goto('/')
  const line = page.locator('.cherrypick-for-you-building .cherrypick-building')
  await expect(line).toContainText(
    /^Reading your library: [\d,]+ of [\d,]+ (scenes|performers)…$/,
    { timeout: 20_000 },
  )
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 30_000 })
  await expect(line).toHaveCount(0)
  // The next load starts from the browser's copy and says nothing.
  await page.reload()
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  expect(await page.evaluate(() => !!window.__sawBuilding)).toBe(false)
})

test('the bracket buttons say why they are greyed out until the model is in', async ({
  page,
}) => {
  await slowLibrary(page)
  await page.goto('/performers')
  const button = page
    .locator('.cherrypick-bracket-button')
    .filter({ visible: true })
    .first()
  await expect(button).toBeDisabled({ timeout: 20_000 })
  await expect(button).toHaveAttribute(
    'title',
    'Cherry Pick is still reading your library',
  )
  await expect(
    page.locator('.cherrypick-bracket-ops').filter({ visible: true }).first(),
  ).toHaveAttribute('title', 'Cherry Pick is still reading your library')
  await expect(button).toBeEnabled({ timeout: 30_000 })
  await expect(button).not.toHaveAttribute(
    'title',
    'Cherry Pick is still reading your library',
  )
})

// Refract floats its cards rated 4.75★ and up for as long as they show (its
// reduced motion rule loses to the float), and a click waits for its target
// to stand still. Beside Refract, a click in a card checks that its target
// shows and goes ahead.
async function press(target) {
  await expect(target).toBeVisible()
  await target.click({ force: companionPluginIds().includes('refract') })
}

test('Not interested hides a card in place and is saved to Stash', async ({
  page,
}) => {
  await page.goto('/')
  const card = forYouCards(page).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  const slide = page.locator(
    '.cherrypick-for-you .slick-active:not(.slick-cloned)',
  )
  await press(slide.first().locator('.cherrypick-card-menu button'))
  await press(slide.first().locator('.cherrypick-ni'))
  // Slick clones slides for its infinite scroll; act on the real ones.
  const hidden = page.locator(
    '.cherrypick-for-you .slick-slide:not(.slick-cloned) .cherrypick-hidden-card',
  )
  await expect(hidden.first()).toBeVisible()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.notInterested || '[]'))
    .toHaveLength(1)
  await hidden.first().locator('.btn').click()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.notInterested || '[]'))
    .toHaveLength(0)
})

test('Your score shows on unrated scene cards only', async ({ page }) => {
  const unrated = demoScene(demo, { rated: false, played: true })
  const rated = demoScene(demo, { rated: true, played: true })
  await page.goto('/scenes?sortby=title&perPage=120')
  await expect(page.locator('.cherrypick-score-banner').first()).toBeVisible({
    timeout: 20_000,
  })
  // The card's link is /scenes/<id>, with a queue query on lists.
  const banner = (id) =>
    page.locator(
      `.scene-card:has(a[href="/scenes/${id}"], a[href^="/scenes/${id}?"]) .cherrypick-score-banner`,
    )
  await expect(banner(unrated)).toHaveCount(1)
  await expect(banner(unrated)).toHaveText(/^~\d\.\d/)
  await expect(banner(rated)).toHaveCount(0)
})

// Stash's ribbon is rotated about its center, so a narrower one stops inside
// the picture and its end shows (#90).
test("Your score's ribbon is as long as Stash's rating ribbon", async ({
  page,
}) => {
  test.skip(
    companionPluginIds().includes('refract'),
    'Refract draws ratings as chips (companions.contract.spec.mjs)',
  )
  const unrated = demoScene(demo, { rated: false, played: true })
  const rated = demoScene(demo, { rated: true, played: true })
  await page.goto('/scenes?sortby=title&perPage=120')
  const card = (id) =>
    page.locator(
      `.scene-card:has(a[href="/scenes/${id}"], a[href^="/scenes/${id}?"])`,
    )
  const ours = card(unrated).locator('.cherrypick-score-banner')
  const stash = card(rated).locator('.rating-banner')
  await expect(ours).toBeVisible({ timeout: 20_000 })
  await expect(stash).toHaveText(/^Rating: \d$/i)
  // offsetWidth is the ribbon's length before the rotation. Ascension and
  // Xenith hide Stash's ribbon on their cards, leaving it no width.
  const width = (l) => l.evaluate((el) => el.offsetWidth)
  const theirs = await width(stash)
  if (!companionPluginIds().length) expect(theirs).toBeGreaterThan(0)
  expect(await width(ours)).toBeGreaterThanOrEqual(theirs - 1)
})

test("Your score shows where another plugin set the rating, in place of Stash's banner", async ({
  page,
}) => {
  // Two unrated, played demo scenes: one an Elo plugin ranks (Ascension's
  // marks), one whose rating is Restash's mirrored score
  const [ranked, mirrored] = DEMO.scenes
    .filter((s) => !s.rating100 && s.plays.length)
    .slice(0, 2)
    .map((s) => demo.scenes[s.title])
  const marks = {
    [ranked]: {
      rating100: 64,
      fields: {
        hotornot_stats: JSON.stringify({ total_matches: 1, wins: 1 }),
        scene_record: JSON.stringify([
          { date: '2026-10-15T20:00:00.000Z', opponentId: '0', won: true },
        ]),
      },
    },
    [mirrored]: { rating100: 47, fields: { restash_score: 47 } },
  }
  const set = (id, rating100, custom_fields) =>
    gql('mutation ($i: SceneUpdateInput!) { sceneUpdate(input: $i) { id } }', {
      i: { id, rating100, custom_fields },
    })
  for (const [id, m] of Object.entries(marks))
    await set(id, m.rating100, { partial: m.fields })
  try {
    await page.goto('/scenes?sortby=title&perPage=120')
    await expect(page.locator('.cherrypick-score-banner').first()).toBeVisible({
      timeout: 20_000,
    })
    for (const id of [ranked, mirrored]) {
      const card = page.locator(
        `.scene-card:has(a[href="/scenes/${id}"], a[href^="/scenes/${id}?"])`,
      )
      await expect(card.locator('.cherrypick-score-banner')).toHaveText(
        /^~\d\.\d/,
      )
      await expect(card.locator('.cherrypick-score-banner')).toBeVisible()
      // Stash's banner carries the other plugin's number (and Refract's
      // chip, beside Refract): Your score takes the corner
      if (companionPluginIds().includes('refract'))
        await expect(card.locator(':scope > .rating-banner')).toBeAttached()
      await expect(
        card.locator('.rating-banner:not(.cherrypick-score-banner):visible'),
      ).toHaveCount(0)
    }
    await page.goto(`/scenes/${mirrored}`)
    await expect(
      page
        .locator(
          '.scene-toolbar .cherrypick-score-line .cherrypick-line-button',
        )
        .first(),
    ).toHaveText(/^likely .* for you$/, { timeout: 20_000 })
  } finally {
    for (const [id, m] of Object.entries(marks))
      await set(id, null, { remove: Object.keys(m.fields) })
  }
})

test('the scene page shows the score line and More like this', async ({
  page,
}) => {
  const unrated = demoScene(demo, { rated: false, played: true })
  await page.goto(`/scenes/${unrated}`)
  const line = page.locator('.scene-toolbar .cherrypick-score-line')
  await expect(line.locator('.cherrypick-line-button').first()).toHaveText(
    /^likely .* for you$/,
    { timeout: 20_000 },
  )
  await expect(
    page.locator('.cherrypick-more-like-this h2', {
      hasText: 'More like this',
    }),
  ).toBeAttached()
  // Without a StashDB key, the second row is the connect line.
  await expect(page.locator('.cherrypick-connect-line')).toBeAttached()
  // Don't learn is in a pick's menu and in its tags setting, not here
  await expect(line).toHaveText(/^likely .* for you$/)
  // Its words sit beside the stars, not on them: a theme that sizes the
  // toolbar's buttons would squeeze the line's button and spill its words
  const onStars = await page.evaluate(() => {
    const stars = document
      .querySelector('.scene-toolbar .rating-stars')
      .getBoundingClientRect()
    const words = document.createRange()
    words.selectNodeContents(
      document.querySelector('.scene-toolbar .cherrypick-line-button'),
    )
    const box = words.getBoundingClientRect()
    return (
      box.left < stars.right &&
      stars.left < box.right &&
      box.top < stars.bottom &&
      stars.top < box.bottom
    )
  })
  expect(onStars).toBe(false)
})

test("Don't learn from this in a pick's menu is saved to Stash", async ({
  page,
}) => {
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  const slide = page
    .locator('.cherrypick-for-you .slick-active:not(.slick-cloned)')
    .first()
  const marks = async () =>
    JSON.parse((await pluginConfig())?.dontLearn || '[]')
  await press(slide.locator('.cherrypick-card-menu button'))
  await press(slide.locator('.cherrypick-dl'))
  await expect.poll(marks).toHaveLength(1)
  await press(slide.locator('.cherrypick-card-menu button'))
  await expect(slide.locator('.cherrypick-dl')).toHaveText(
    'Not learning from this (undo)',
  )
  await press(slide.locator('.cherrypick-dl'))
  await expect.poll(marks).toHaveLength(0)
})

test("Cherry Pick's page counts the scenes with a tag it doesn't learn from", async ({
  page,
}) => {
  const { name } = DEMO.tags[0]
  const n = DEMO.scenes.filter((s) => s.tags.includes(name)).length
  const before = await pluginConfig()
  // Names match in any case; one no scene has is named on the page
  await setPluginSettings(PLUGIN_ID, {
    ...before,
    dontLearnTags: `${name.toUpperCase()}, No such tag`,
  })
  try {
    await page.goto('/plugins/cherrypick/manage')
    const section = page.locator('#dont-learn')
    await expect(section).toContainText(
      `Scenes tagged ${name.toUpperCase()} or No such tag`,
    )
    await expect(section).toContainText(new RegExp(`(^|\\D)${n} scenes? ·`), {
      timeout: 20_000,
    })
    await expect(section).toContainText('No scene has the tag No such tag')
  } finally {
    await setPluginSettings(PLUGIN_ID, before)
  }
})

// Stash draws a row's arrows outside its slider. More like this is as wide as
// the page, so arrows that land past its edge make the page scroll sideways.
// Below Stash's xl breakpoint it follows the scene's tabs, whose performer
// cards spill out of a box Stash caps at the window's height.
test("More like this fits the page and clears the scene's details", async ({
  page,
}) => {
  const scene = demoScene(demo, { rated: false, played: true })
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/scenes/${scene}`)
    const row = page.locator('.cherrypick-more-like-this')
    await expect(row.locator('.slick-arrow').first()).toBeVisible({
      timeout: 20_000,
    })
    const past = await row.evaluate((el) =>
      [...el.querySelectorAll('.slick-list, .slick-arrow')]
        .map((e) => [e.className, e.getBoundingClientRect()])
        .filter(([, b]) => b.left < 0 || b.right > window.innerWidth)
        .map(([c, b]) => `${c}: ${b.left} to ${b.right}`),
    )
    expect(past, `at ${width} wide`).toEqual([])
    // Another plugin's pieces may widen the page in a companion leg
    if (!companionPluginIds().length)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        `at ${width} wide`,
      ).toBe(0)
  }
  // Still 390 wide: the demo scene's performer cards run past one screen.
  // What shows of each piece: a box that clips its overflow cuts off what
  // runs past it, such as the glare Refract lays over each card
  const overlap = await page.evaluate(() => {
    const tabs = document.querySelector('.scene-tabs')
    const shown = (e) => {
      let bottom = e.getBoundingClientRect().bottom
      for (
        let a = e.parentElement;
        a !== tabs.parentElement;
        a = a.parentElement
      )
        if (getComputedStyle(a).overflowY !== 'visible')
          bottom = Math.min(bottom, a.getBoundingClientRect().bottom)
      return bottom
    }
    const bottom = Math.max(...[...tabs.querySelectorAll('*')].map(shown))
    const top = document
      .querySelector('.cherrypick-more-like-this')
      .getBoundingClientRect().top
    return bottom - top
  })
  expect(overlap).toBeLessThanOrEqual(0)
})

test('nothing of Cherry Pick shows once the scene plays', async ({ page }) => {
  // A shared clip, so there is a player. A play event is enough: the clip
  // need not run, and its play count stays as the themes' screenshots expect.
  await page.goto(`/scenes/${shared.scene}`)
  const ui = page.locator('.cherrypick-more-like-this')
  await expect(ui).toBeAttached({ timeout: 20_000 })
  await page
    .locator('.scene-player-container video')
    .first()
    .evaluate((v) => v.dispatchEvent(new Event('play')))
  await expect(page.locator('body')).toHaveClass(/cherrypick-watching/)
  await expect(ui).toBeHidden()
  await expect(page.locator('.cherrypick-nav-icon').first()).toBeHidden()
})

test('the navbar cherries open the plugin page on For you, which survives a reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.cherrypick-nav-icon').filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/plugins\/cherrypick$/)
  await expect(page.locator('.cherrypick-page h1').first()).toContainText(
    'Cherry Pick',
  )
  await expect(page.locator('.cherrypick-tabs .nav-link.active')).toHaveText(
    'For you',
  )
  await page.reload()
  await expect(
    page.locator('.cherrypick-fy-list .scene-card').first(),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.cherrypick-strip')).toContainText(
    /Your score is (on: within half a star \d+ times in 10|waiting)/,
  )
})

test("the navbar keeps Stash's items and another plugin's list beside the cherries", async ({
  page,
}) => {
  // Xenith's after patch on MainNavBar.UtilityItems returns [result, the
  // host of its dialog], and Stash hands the next after patch each item as
  // an argument of its own. A stand-in registers the same kind of patch as
  // soon as Stash sets PluginApi, before any plugin loads, so Cherry Pick's
  // patch runs after it. Beside Xenith itself, whose patch reads only the
  // third argument and so drops the stand-in's element before Cherry Pick
  // sees it, Xenith's dialog must open with its cards instead.
  const xenith = companionPluginIds().includes('xenith')
  await page.addInitScript(() => {
    let api
    Object.defineProperty(window, 'PluginApi', {
      configurable: true,
      get: () => api,
      set(value) {
        api = value
        api.patch.after('MainNavBar.UtilityItems', (props, ...rest) => [
          rest[rest.length - 1],
          api.React.createElement('span', {
            key: 'list-patch',
            className: 'list-patch-probe',
          }),
        ])
      },
    })
  })
  await page.goto('/')
  await expect(page.locator('.cherrypick-nav-icon').first()).toBeAttached({
    timeout: 20_000,
  })
  await expect(
    page.locator('.navbar a.nav-utility[href="/settings"]').first(),
  ).toBeAttached()
  if (xenith) {
    await page.locator('#hon-floating-btn').click()
    await expect(
      page.locator('#hon-app-mount .hon-choose-btn').first(),
    ).toBeVisible({ timeout: 20_000 })
  } else {
    await expect(page.locator('.list-patch-probe').first()).toBeAttached()
  }
})

test('Settings › Plugins lists the switches, already on', async ({ page }) => {
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  // Cherry Pick wrote its defaults at first load.
  await expect.poll(async () => (await pluginConfig())?.showForYou).toBe(true)
  await page.goto('/settings?tab=plugins')
  // Stash gives each setting's switch the id plugin-<plugin>-<setting>.
  const toggle = page.locator('#plugin-CherryPick-showForYou')
  await expect(toggle).toBeAttached({ timeout: 20_000 })
  await expect(toggle).toBeChecked()
  // Learning from other plugins' matches starts on too
  await expect(
    page.locator('#plugin-CherryPick-learnFromMatches'),
  ).toBeChecked()
  // and so does applying bracket ratings, unless a plugin that writes
  // Stash's ratings is on (Restash only with its mirror on)
  const managed = ['ascension', 'hotornot', 'xenith'].some((c) =>
    companionPluginIds().includes(c),
  )
  const auto = page.locator('#plugin-CherryPick-autoApply')
  if (managed) await expect(auto).not.toBeChecked()
  else await expect(auto).toBeChecked()
})

// Stash 0.30 to 0.31.1 can freeze when a configuration write reaches it
// while it serves the image of a performer with none or a configuration
// query (runtime/settle.js). Cherry Pick reads Stash's own copy of its
// configuration, writes its first-load defaults once, after the list's
// images, and on a load with nothing to change writes nothing.
test('the first load writes once, with no image out, and the next load writes nothing', async ({
  page,
}) => {
  const before = await pluginConfig()
  const seen = []
  page.on('request', (r) => {
    const op = r.url().endsWith('/graphql')
      ? r.postDataJSON()?.operationName
      : /\/performer\/\d+\/image\?.*default=true/.test(r.url())
        ? 'no image'
        : null
    if (op) seen.push({ r, op, start: Date.now(), end: Infinity })
  })
  const done = (r) => {
    const e = seen.find((x) => x.r === r)
    if (e) e.end = Date.now()
  }
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  const sent = (op) => seen.filter((e) => e.op === op)
  try {
    await setPluginSettings(PLUGIN_ID, {})
    await page.goto('/performers')
    await expect
      .poll(async () => (await pluginConfig())?.showForYou, { timeout: 20_000 })
      .toBe(true)
    const writes = sent('CherryPickConfigurePlugin')
    expect(writes).toHaveLength(1)
    // Firefox loads a lazy image only once it is on screen, so the list's
    // images of performers with none may not load at all
    const out = sent('no image').filter(
      (i) => i.start <= writes[0].start && i.end >= writes[0].start,
    )
    expect(out).toHaveLength(0)
    // its one configuration query: the map, read just before the write
    expect(sent('CherryPickConfiguration')).toHaveLength(1)

    seen.length = 0
    await page.reload()
    await expect(
      page.locator('.cherrypick-bracket-button').filter({ visible: true }),
    ).not.toHaveCount(0, { timeout: 20_000 })
    // longer than a write would wait: a second of quiet, then the page
    // settling
    await page.waitForTimeout(3000)
    expect(sent('CherryPickConfigurePlugin')).toHaveLength(0)
    expect(sent('CherryPickConfiguration')).toHaveLength(0)
  } finally {
    await setPluginSettings(PLUGIN_ID, before)
  }
})

test('without Stash Curator, nothing offers to hide Your score on cards', async ({
  page,
}) => {
  test.skip(
    companionPluginIds().includes('stash-curator'),
    'Stash Curator is installed',
  )
  // Cherry Pick asks Stash which plugins are installed, and Curator is not
  const asked = () =>
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/graphql') &&
        r.request().postDataJSON()?.operationName === 'CherryPickPlugins',
    )
  const offer = page.locator('.cherrypick-curator-offer')
  let answer = asked()
  await page.goto('/plugins/cherrypick/manage')
  await answer
  await expect(page.locator('#your-score')).toContainText(
    /within half a star \d+ times in 10/,
    { timeout: 20_000 },
  )
  await expect(offer).toHaveCount(0)
  answer = asked()
  await page.goto('/settings?tab=plugins')
  await answer
  await expect(page.locator('#plugin-CherryPick-badges')).toBeAttached({
    timeout: 20_000,
  })
  await page.waitForTimeout(500)
  await expect(offer).toHaveCount(0)
})

test('switching For you off removes the row and the tab', async ({ page }) => {
  // Through the configuration, as Stash's Settings page saves it: develop
  // collapses each plugin's settings, so the switch is not always visible.
  const before = await pluginConfig()
  await setPluginSettings(PLUGIN_ID, { ...before, showForYou: false })
  try {
    await page.goto('/')
    await page.locator('.recommendations-container').first().waitFor()
    await expect(page.locator('.cherrypick-front')).toBeAttached({
      timeout: 20_000,
    })
    await page.waitForTimeout(2000)
    await expect(page.locator('.cherrypick-for-you')).toHaveCount(0)
    // Cherry Pick's page opens on the Hall of Fame, with no For you tab
    await page.goto('/plugins/cherrypick')
    await expect(page.locator('.cherrypick-tabs .nav-link.active')).toHaveText(
      'Hall of Fame',
      { timeout: 20_000 },
    )
    await expect(page.locator('.cherrypick-tabs .nav-link')).toHaveText([
      'Hall of Fame',
      'Manage',
    ])
  } finally {
    await setPluginSettings(PLUGIN_ID, before)
  }
})

test("with the switch on, other plugins' matches reach the model", async ({
  page,
}) => {
  // Three demo performers as HotOrNot_V3 leaves them: two matches, each in
  // both players' records, and a skip
  const [a, b, c] = Object.values(demo.performers)
  const match = (opponent, won, minute) => ({
    date: `2026-10-15T20:0${minute}:00.000Z`,
    opponent: `${opponent}:Someone`,
    won,
    ratingAfter: 50,
  })
  const records = {
    [a]: [match(b, true, 0), match(c, true, 1)],
    [b]: [match(a, false, 0), match(c, null, 2)],
    [c]: [match(a, false, 1), match(b, null, 2)],
  }
  const write = (id, custom_fields) =>
    gql(
      'mutation ($i: PerformerUpdateInput!) { performerUpdate(input: $i) { id } }',
      { i: { id, custom_fields } },
    )
  for (const [id, list] of Object.entries(records))
    await write(id, { partial: { performer_record: JSON.stringify(list) } })
  const before = await pluginConfig()
  await setPluginSettings(PLUGIN_ID, { ...before, learnFromMatches: true })
  try {
    await page.goto('/plugins/cherrypick/manage')
    await expect(page.locator('#your-score')).toContainText(
      '2 matches in HotOrNot',
      { timeout: 20_000 },
    )
  } finally {
    await setPluginSettings(PLUGIN_ID, before)
    for (const id of Object.keys(records))
      await write(id, { remove: ['performer_record'] })
  }
})

test('Remove Cherry Pick data leaves a tombstone', async ({ page }) => {
  await page.goto('/plugins/cherrypick/manage')
  // The tab's sections render at once, Your score as "Learning your taste…", and
  // grows by a row when the model lands, which moves Remove down. A click
  // that Playwright dispatches in that moment lands on the section beside the
  // button, and Playwright does not retry it: the dialog never opens.
  await expect(page.locator('#your-score')).toContainText(
    /within half a star \d+ times in 10/,
    { timeout: 20_000 },
  )
  await page.locator('#remove .btn-danger').click()
  const dialog = page.locator('.modal-dialog')
  await expect(dialog).toContainText('Remove Cherry Pick data?')
  await dialog.locator('.btn-danger').click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await pluginConfig())?.removedAt).toBeTruthy()
})
