// Checks that Cherry Pick's pieces render in Stash's pages, on the seams
// docs/stash-seams.md lists, and that what it stores reaches Stash.
import { expect, test } from '@playwright/test'
import { companionPluginIds } from '../../../tests/stash/companions.mjs'
import {
  PLUGIN_ID,
  demoScene,
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

test('Not interested hides a card in place and is saved to Stash', async ({
  page,
}) => {
  await page.goto('/')
  const card = forYouCards(page).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  const slide = page.locator(
    '.cherrypick-for-you .slick-active:not(.slick-cloned)',
  )
  await slide.first().locator('.cherrypick-card-menu button').click()
  await slide.first().locator('.cherrypick-ni').click()
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

test("the scene page shows the score line, Don't learn and More like this", async ({
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

  await line.locator('.cherrypick-dont-learn').click()
  await expect(line.locator('.cherrypick-dont-learn')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.dontLearn || '[]'))
    .toEqual([expect.objectContaining({ sceneId: unrated })])
  await line.locator('.cherrypick-dont-learn').click()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.dontLearn || '[]'))
    .toEqual([])
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

test('the navbar cherries open the plugin page, which survives a reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.cherrypick-nav-icon').filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/plugins\/cherrypick$/)
  await expect(page.locator('.cherrypick-page h1').first()).toContainText(
    'Cherry Pick',
  )
  await page.reload()
  await expect(page.locator('#your-score')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#your-score')).toContainText(
    /within half a star \d+ times in 10/,
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
  await page.goto('/plugins/cherrypick')
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

test('switching For you off removes the row', async ({ page }) => {
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
    await page.goto('/plugins/cherrypick')
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
  await page.goto('/plugins/cherrypick')
  await page.locator('#remove .btn-danger').click()
  const dialog = page.locator('.modal-dialog')
  await expect(dialog).toContainText('Remove Cherry Pick data?')
  await dialog.locator('.btn-danger').click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await pluginConfig())?.removedAt).toBeTruthy()
})
