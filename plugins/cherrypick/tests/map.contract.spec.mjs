// Checks the bracket map, the way a bracket plays unless Brackets Classic
// Mode is on: a match arriving (a pick made while it arrives only skips the
// arrival), the winner landing in the next round with the cherries moving
// on, Undo, the Challenge round's road to the trophy, New bracket setting
// the finished bracket's ratings and starting the next one in one click,
// the map on a phone, and Classic Mode's plain match. Motion stays on here;
// the other specs play brackets with reduced motion.
import { expect, test } from '@playwright/test'
import {
  gql,
  PLUGIN_ID,
  pickCandidate,
  demoCandidates,
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
// each test starts with no bracket in play or in the Hall of Fame
test.beforeEach(() => setPluginSettings(PLUGIN_ID, {}))

const visible = (locator) => locator.filter({ visible: true }).first()

async function settings(values) {
  await setPluginSettings(PLUGIN_ID, {
    ...((await pluginConfig()) || {}),
    ...values,
  })
}

async function performerRatings(ids) {
  const { findPerformers } = await gql(
    `query ($ids: [ID!]) {
      findPerformers(ids: $ids, filter: { per_page: -1 }) {
        performers { id rating100 } }
    }`,
    { ids },
  )
  return Object.fromEntries(
    findPerformers.performers.map((p) => [p.id, p.rating100]),
  )
}

const setPerformerRating = (id, rating100) =>
  gql(
    'mutation ($i: PerformerUpdateInput!) { performerUpdate(input: $i) { id } }',
    { i: { id, rating100 } },
  )

async function sceneRatings(ids) {
  const { findScenes } = await gql(
    `query ($ids: [ID!]) {
      findScenes(ids: $ids, filter: { per_page: -1 }) {
        scenes { id rating100 } }
    }`,
    { ids },
  )
  return Object.fromEntries(findScenes.scenes.map((x) => [x.id, x.rating100]))
}

const setSceneRating = (id, rating100) =>
  gql('mutation ($i: SceneUpdateInput!) { sceneUpdate(input: $i) { id } }', {
    i: { id, rating100 },
  })

// Puts the demo performers' and scenes' ratings back after a test that
// changes them
async function keepingRatings(fn) {
  const ids = Object.values(demo.performers)
  const sceneIds = Object.values(demo.scenes)
  const before = await performerRatings(ids)
  const scenesBefore = await sceneRatings(sceneIds)
  try {
    await fn(ids, sceneIds)
  } finally {
    for (const [id, r] of Object.entries(before))
      await setPerformerRating(id, r)
    for (const [id, r] of Object.entries(scenesBefore))
      await setSceneRating(id, r)
  }
}

async function openBracket(page) {
  await page.goto('/performers')
  const bracket = visible(page.locator('.cherrypick-bracket-button'))
  await expect(bracket).toBeVisible({ timeout: 20_000 })
  await bracket.click()
  const play = page.locator('.cherrypick-play-modal')
  await expect(play).toContainText('16 performers')
  return play
}

// The opening banner has gone and the first match has arrived
const opened = (play) =>
  expect(play.locator('.cherrypick-banner')).toBeHidden({ timeout: 5_000 })

const round = (play) => play.locator('.cherrypick-round')

test('a pick lands the winner in the next round and moves the cherries on; a pick while a match arrives only skips its arrival', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const play = await openBracket(page)
  await expect(play.locator('.cherrypick-map-vp')).toBeVisible()
  await expect(play.locator('.cherrypick-sound')).toBeVisible()
  await expect(play.locator('.cherrypick-map-node.now')).toHaveAttribute(
    'data-node',
    '0-0',
  )
  await expect(play.locator('.cherrypick-map-marker')).toBeAttached()
  await opened(play)
  const live = play.locator('.cherrypick-layer.live')
  const names = await live.locator('.cherrypick-cont-title').allInnerTexts()
  expect(names).toHaveLength(2)
  // no rating, seed or star on the match or the map
  await expect(play.locator('.cherrypick-stage')).not.toContainText('★')
  await expect(play.locator('.cherrypick-stage')).not.toContainText('seed')

  await live.locator('.cherrypick-contender').first().click()
  await expect(round(play)).toHaveText('Round of 16 · match 2 of 8')
  await expect(
    play.locator('[data-node="1-0"] .cherrypick-map-slot').first(),
  ).toContainText(names[0])
  await expect(play.locator('.cherrypick-map-node.now')).toHaveAttribute(
    'data-node',
    '0-1',
  )
  await expect(play.locator('.cherrypick-map-path.won')).toHaveCount(1)

  // two keys at once: the first picks, the second only ends the arrival
  await page.waitForTimeout(600)
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(round(play)).toHaveText('Round of 16 · match 3 of 8')
  await page.waitForTimeout(800)
  await expect(round(play)).toHaveText('Round of 16 · match 3 of 8')

  // Undo goes back a match, and the map with it
  await page.keyboard.press('u')
  await expect(round(play)).toHaveText('Round of 16 · match 2 of 8')
  await expect(play.locator('.cherrypick-map-slot.in')).toHaveCount(1)
  await expect(play.locator('.cherrypick-map-node.now')).toHaveAttribute(
    'data-node',
    '0-1',
  )

  // Show bracket opens the whole map, without the match
  await play.getByRole('button', { name: 'Show bracket' }).click()
  await expect(play.locator('.cherrypick-layer.live')).toBeHidden()
  await expect(play.locator('[data-node="trophy"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('the Challenge round plays on its own road, and beating every favorite ends on the trophy', async ({
  page,
}) => {
  // Every demo performer and scene unrated but three Female favorites, so
  // the bracket plays only unrated performers and its champion meets them
  test.setTimeout(120_000)
  const favorites = { 'Edie Flint': 20, 'Hana Ridge': 70, 'Bea Lark': 100 }
  await settings({ autoApply: false })
  await keepingRatings(async (ids, sceneIds) => {
    for (const id of ids) await setPerformerRating(id, null)
    for (const id of sceneIds) await setSceneRating(id, null)
    for (const [name, r] of Object.entries(favorites))
      await setPerformerRating(demo.performers[name], r)
    const play = await openBracket(page)
    await opened(play)
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowLeft')
      // a new round's banner takes longer than a match
      await page.waitForTimeout([7, 11, 13].includes(i) ? 1300 : 450)
    }
    // the champion's moment, then the champion screen
    const result = page.locator('.cherrypick-result-modal')
    await expect(result.locator('.cherrypick-intro')).toContainText('Champion')
    await page.keyboard.press('Enter')
    await expect(result.locator('.cherrypick-intro')).toHaveCount(0)
    await result.locator('.cherrypick-challenge-start').click()

    const ch = page.locator('.cherrypick-challenge-modal')
    const road = ch.locator('.cherrypick-gauntlet')
    await expect(road.locator('.cherrypick-gauntlet-node')).toHaveCount(5)
    // the favorites show as the champion reaches them
    await expect(road.locator('.cherrypick-gauntlet-node.hidden')).toHaveCount(
      2,
    )
    await expect(road.locator('.cherrypick-gauntlet-node.now')).toContainText(
      'Edie Flint',
    )
    await expect(ch.locator('.cherrypick-stage')).not.toContainText('★')
    await opened(ch)
    for (let i = 0; i < 3; i++) {
      await expect(ch).toContainText(`Favorite ${i + 1} of 3`)
      const sides = ch.locator('.cherrypick-layer.live .cherrypick-map-side')
      const crowned = await sides.evaluateAll((els) =>
        els.findIndex((el) => el.querySelector('.cherrypick-crown')),
      )
      await page.waitForTimeout(450)
      await page.keyboard.press(crowned === 0 ? 'ArrowLeft' : 'ArrowRight')
      if (i < 2)
        await expect(
          road.locator('.cherrypick-gauntlet-node.beaten'),
        ).toHaveCount(i + 1)
    }
    await expect(result.locator('.cherrypick-intro')).toContainText('Trophy')
    await expect(
      result.locator('.cherrypick-intro .cherrypick-gauntlet-node.trophy.won'),
    ).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(result.locator('.cherrypick-challenge-badge')).toHaveText(
      'Beat your favorites',
    )
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('picks made at once leave the camera on the match being played', async ({
    page,
  }) => {
    const play = await openBracket(page)
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
    await expect(round(play)).toHaveText('Round of 16 · match 4 of 8')
    // at full size, as the camera shows the match it follows (the whole
    // map would show it at under half)
    await expect
      .poll(() =>
        play
          .locator('.cherrypick-map-node.now')
          .evaluate((el) => el.getBoundingClientRect().width / el.offsetWidth),
      )
      .toBeGreaterThan(0.9)
  })

  test('New bracket sets the finished bracket’s ratings and starts the next one in one click', async ({
    page,
  }) => {
    await keepingRatings(async () => {
      const play = await openBracket(page)
      const candidates = demoCandidates()
      for (let i = 0; i < 15; i++) {
        await pickCandidate(page, play, candidates)
        await page.waitForTimeout(150)
      }
      const result = page.locator('.cherrypick-result-modal')
      await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
      const names = [...candidates].filter((n) => demo.performers[n])
      const unrated = Object.entries(
        await performerRatings(names.map((n) => demo.performers[n])),
      )
        .filter(([, r]) => r == null)
        .map(([id]) => id)
      await expect(result).toContainText(/Closing this sets \d+ performer/)
      await result.locator('.cherrypick-new-bracket').click()
      // the next bracket is open, from its first match
      await expect(result).toHaveCount(0)
      await expect(play.locator('.cherrypick-round')).toHaveText(
        'Round of 16 · match 1 of 8',
      )
      // and the last one's ratings are set, as Done would have set them
      const now = await performerRatings(unrated)
      expect(
        Object.values(now).filter((r) => r != null).length,
      ).toBeGreaterThan(0)
    })
  })
})

test('Brackets Classic Mode plays the plain match, and keeps New bracket', async ({
  page,
}) => {
  await settings({ classicBrackets: true })
  try {
    const play = await openBracket(page)
    await expect(play.locator('.cherrypick-map-vp')).toHaveCount(0)
    await expect(play.locator('.cherrypick-sound')).toHaveCount(0)
    await expect(
      play.locator('.cherrypick-match .cherrypick-contender'),
    ).toHaveCount(2)
    // no arrival to wait for: keys in a row each pick
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(150)
    }
    const result = page.locator('.cherrypick-result-modal')
    await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
    await expect(result.locator('.cherrypick-intro')).toHaveCount(0)
    await expect(result.locator('.cherrypick-new-bracket')).toBeVisible()
    await result.getByRole('button', { name: 'Show bracket' }).click()
    await expect(result.locator('.cherrypick-tree')).toBeVisible()
  } finally {
    await settings({ classicBrackets: false })
  }
})

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  test('the match and the map fit a phone screen, and the whole map scrolls', async ({
    page,
  }) => {
    const play = await openBracket(page)
    await opened(play)
    const overflow = () =>
      page.evaluate(() => {
        const body = document.querySelector(
          '.cherrypick-play-modal .modal-body',
        )
        return Math.max(
          document.documentElement.scrollWidth - window.innerWidth,
          body.scrollWidth - body.clientWidth,
        )
      })
    expect(await overflow()).toBe(0)
    // both cards and the map are on screen, above the footer
    const footer = await play.locator('.modal-footer').boundingBox()
    const map = await play.locator('.cherrypick-map-vp').boundingBox()
    expect(map.y + map.height).toBeLessThanOrEqual(footer.y)
    const live = play.locator('.cherrypick-layer.live')
    await live.locator('.cherrypick-contender').nth(1).tap()
    await expect(play.locator('.cherrypick-round')).toHaveText(
      'Round of 16 · match 2 of 8',
    )
    expect(await overflow()).toBe(0)
    // the whole map is too big for a phone: full size, to scroll through
    await play.getByRole('button', { name: 'Show bracket' }).click()
    const vp = play.locator('.cherrypick-map-vp.scroll')
    await expect(vp).toBeVisible()
    expect(await vp.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    )
    expect(await overflow()).toBe(0)
  })
})
