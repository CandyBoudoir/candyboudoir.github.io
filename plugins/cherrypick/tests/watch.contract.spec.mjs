// Watch This: with its setting on, one scene in Stash's own player takes the
// place of Cherry Pick's front-page rows. Checks the setting, the player,
// what Stash records when it plays, Stash's Auto-start video setting, the
// layout at desktop and phone widths, and each CandyBoudoir theme. Stash
// Curator patches ScenePlayer, so its leg runs this file too.
//
// Only the shared demo clips have video, so every pick is one of them. The
// spec plays them, and puts their plays, play time and resume points back
// as they were afterwards, for the themes' screenshots.
import { expect, test } from '@playwright/test'
import { listPlugins } from '../../../scripts/site.mjs'
import {
  PLUGIN_ID,
  forYouCards,
  gql,
  pluginConfig,
  setPluginSettings,
  setUpCherryPick,
  sharedScenes,
  tearDownCherryPick,
  usePlugins,
} from './stash.mjs'

const setWatchThis = async (on) =>
  setPluginSettings(PLUGIN_ID, {
    ...((await pluginConfig()) || {}),
    watchThis: on,
  })

const setAutostart = (on) =>
  gql(
    'mutation ($on: Boolean) { configureInterface(input: { autostartVideo: $on }) { autostartVideo } }',
    { on },
  )

// What Stash keeps of a scene's watching
async function activity(id) {
  const { findScene } = await gql(
    'query ($id: ID!) { findScene(id: $id) { play_count play_duration resume_time play_history } }',
    { id },
  )
  return findScene
}

async function clipsActivity() {
  const clips = await sharedScenes()
  return Promise.all(
    clips.map(async (s) => ({ id: s.id, ...(await activity(s.id)) })),
  )
}

async function restoreActivity(before) {
  for (const b of before) {
    const now = await activity(b.id)
    const added = now.play_history.filter((t) => !b.play_history.includes(t))
    if (added.length)
      await gql(
        'mutation ($id: ID!, $t: [Timestamp!]) { sceneDeletePlay(id: $id, times: $t) { count } }',
        { id: b.id, t: added },
      )
    await gql(
      'mutation ($id: ID!) { sceneResetActivity(id: $id, reset_resume: true, reset_duration: true) }',
      { id: b.id },
    )
    if (b.resume_time || b.play_duration)
      await gql(
        'mutation ($id: ID!, $r: Float, $d: Float) { sceneSaveActivity(id: $id, resume_time: $r, playDuration: $d) }',
        { id: b.id, r: b.resume_time, d: b.play_duration },
      )
  }
}

let clips
let autostart
test.beforeAll(async () => {
  await setUpCherryPick()
  clips = await clipsActivity()
  const { configuration } = await gql(
    '{ configuration { interface { autostartVideo } } }',
  )
  autostart = !!configuration.interface.autostartVideo
  await setAutostart(false)
})
test.afterAll(async () => {
  await restoreActivity(clips)
  await setAutostart(autostart)
  await tearDownCherryPick()
  await usePlugins(PLUGIN_ID)
})

const player = (page) => page.locator('.cherrypick-watch-player .video-js')
const line = (page) => page.locator('.cherrypick-watch-line')
// The pick's line, once the player has its scene (the skeleton has a line
// of its own for the progress)
const ready = (page) =>
  expect(page.locator('.cherrypick-watch-title')).toBeVisible({
    timeout: 20_000,
  })
const pickId = async (page) =>
  (await page.locator('.cherrypick-watch-title').getAttribute('href'))
    .split('/')
    .pop()

// Cherry Pick's pieces a user could see on the page
const visibleOurs = (page) =>
  page.locator('.cherrypick-ui').filter({ visible: true }).count()

test('with Watch This off, the front page is as it was', async ({ page }) => {
  await setWatchThis(false)
  await page.goto('/')
  await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.cherrypick-watch')).toHaveCount(0)
})

test("with Watch This on, one player takes the place of Cherry Pick's rows, above Stash's", async ({
  page,
}) => {
  await setWatchThis(true)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(player(page)).toBeVisible({ timeout: 20_000 })
  await expect(line(page)).toBeVisible()
  await expect(
    page.locator('.cherrypick-watch-player .VideoPlayer'),
  ).toHaveCount(1)
  // No For you, no rows that follow your watching, no Hall of Fame
  await expect(page.locator('.cherrypick-front')).toHaveCount(0)
  await expect(page.locator('.cherrypick-row')).toHaveCount(0)
  // Stash's rows and Customise button follow the player
  const order = await page.evaluate(() => {
    const ours = document.querySelector('.cherrypick-watch')
    const stash = document.querySelector('.recommendations-container')
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
  // The pick is a scene with video, with its performers and a reason
  const clipIds = (await sharedScenes()).map((s) => s.id)
  expect(clipIds).toContain(await pickId(page))
  await expect(page.locator('.cherrypick-watch-performers a')).not.toHaveCount(
    0,
  )
  await expect(page.locator('.cherrypick-watch-reason')).not.toBeEmpty()
  // The rows' switches keep their values for when Watch This goes off
  const config = await pluginConfig()
  expect([
    config.showForYou,
    config.showFollowRows,
    config.showHallOfFame,
  ]).toEqual([true, true, true])
  expect(errors).toEqual([])
})

test('Space plays the pick, Stash records it, the line steps out and the end brings nothing', async ({
  page,
}) => {
  await setWatchThis(true)
  await page.goto('/')
  await ready(page)
  const id = await pickId(page)
  const before = await activity(id)
  // The player takes focus when the scene loads, as on the scene page
  await expect
    .poll(() =>
      page.evaluate(
        () => !!document.activeElement?.closest('.cherrypick-watch-player'),
      ),
    )
    .toBe(true)
  await page.keyboard.press('Space')
  await expect(player(page)).toHaveClass(/vjs-playing/)
  await expect(line(page)).toHaveCount(0)
  await page.waitForTimeout(3500)
  // Paused, Stash saves the play time and resume point and counts the play
  await page.keyboard.press('Space')
  await expect(player(page)).toHaveClass(/vjs-paused/)
  await expect
    .poll(async () => (await activity(id)).play_duration, { timeout: 10_000 })
    .toBeGreaterThan(before.play_duration)
  const paused = await activity(id)
  expect(paused.resume_time).toBeGreaterThan(1)
  expect(paused.play_count).toBe(before.play_count + 1)
  expect(await visibleOurs(page)).toBe(0)
  // To the end: nothing happens, and nothing of Cherry Pick's comes back
  await page.keyboard.press('Space')
  await expect(player(page)).toHaveClass(/vjs-ended/, { timeout: 20_000 })
  await page.waitForTimeout(3000)
  expect(new URL(page.url()).pathname).toBe('/')
  // Still the same scene, stopped at its end
  const video = await page
    .locator('.cherrypick-watch-player video')
    .evaluate((v) => ({ src: v.currentSrc, ended: v.ended }))
  expect(video.ended).toBe(true)
  expect(video.src).toContain(`/scene/${id}/`)
  await expect(page.locator('.modal')).toHaveCount(0)
  expect(await visibleOurs(page)).toBe(0)
  await expect(line(page)).toHaveCount(0)
  // At the end Stash clears the resume point, as on the scene page
  await expect
    .poll(async () => (await activity(id)).resume_time, { timeout: 10_000 })
    .toBe(0)
  expect((await activity(id)).play_count).toBe(before.play_count + 1)
  // Leaving the front page and coming back brings the line back
  await page.goto('/scenes')
  await page.goto('/')
  await ready(page)
})

test("Stash's Auto-start video decides whether the pick starts by itself", async ({
  page,
}) => {
  await setWatchThis(true)
  await setAutostart(true)
  try {
    await page.goto('/')
    await expect(player(page)).toHaveClass(/vjs-playing/, { timeout: 20_000 })
    await expect(line(page)).toHaveCount(0)
  } finally {
    await setAutostart(false)
  }
  await page.goto('/scenes')
  await page.goto('/')
  await ready(page)
  await page.waitForTimeout(2000)
  await expect(player(page)).not.toHaveClass(/vjs-has-started/)
  await page.locator('.cherrypick-watch-player .vjs-big-play-button').click()
  await expect(player(page)).toHaveClass(/vjs-playing/)
})

test('at 1440×900 the line under the player shows without scrolling', async ({
  page,
}) => {
  await setWatchThis(true)
  await page.goto('/')
  await ready(page)
  const box = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect()
    return {
      scrollY: window.scrollY,
      height: window.innerHeight,
      line: r('.cherrypick-watch-line').bottom,
      player: r('.cherrypick-watch-player').width,
      video: r('.cherrypick-watch .video-wrapper'),
      stash: r('.recommendations-container').width,
    }
  })
  expect(box.scrollY).toBe(0)
  expect(box.line).toBeLessThanOrEqual(box.height)
  // Theatre width: the content area's, as wide as Stash's rows
  expect(box.player).toBe(box.stash)
  expect(box.video.height).toBeLessThanOrEqual((box.video.width * 9) / 16 + 1)
})

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  test('at 390 wide the player is full width at 16:9 and nothing scrolls sideways', async ({
    page,
  }) => {
    await setWatchThis(true)
    await page.goto('/')
    await ready(page)
    const box = await page.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        video: r('.cherrypick-watch .video-wrapper'),
        line: r('.cherrypick-watch-line'),
        stash: r('.recommendations-container').width,
      }
    })
    expect(box.overflow).toBe(0)
    expect(box.video.width).toBe(box.stash)
    expect(
      Math.abs(box.video.height - (box.video.width * 9) / 16),
    ).toBeLessThan(1)
    expect(box.line.top).toBeGreaterThanOrEqual(box.video.bottom)
  })
})

// Every CandyBoudoir theme but the incubating ones, as in
// themes.contract.spec.mjs
const themes = (await listPlugins())
  .filter(({ mod }) => mod.kind === 'theme' && !mod.incubating)
  .map(({ mod }) => mod.id)

for (const theme of themes) {
  test(`with ${theme}: the player and its line render, the line on screen`, async ({
    page,
  }) => {
    await usePlugins(PLUGIN_ID, theme)
    await setWatchThis(true)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await page.goto('/')
      await expect(player(page)).toBeVisible({ timeout: 20_000 })
      await expect(line(page)).toBeVisible()
      const bottom = await line(page).evaluate(
        (el) => el.getBoundingClientRect().bottom,
      )
      expect(bottom).toBeLessThanOrEqual(900)
      expect(errors).toEqual([])
    } finally {
      await usePlugins(PLUGIN_ID)
    }
  })
}
