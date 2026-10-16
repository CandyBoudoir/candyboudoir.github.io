// Checks Cherry Pick's brackets in Stash: the Bracket button beside the
// Performers and Scenes lists, a bracket played to its champion with the
// keyboard, the custom fields written at the end, no ratings while you pick,
// Apply's ratings for the unrated only, performers anchored by their scenes'
// ratings, and pause and resume.
import { expect, test } from '@playwright/test'
import { DEMO, gql, setUpCherryPick, tearDownCherryPick } from './stash.mjs'

let demo
test.beforeAll(async () => {
  ;({ demo } = await setUpCherryPick())
})
test.afterAll(tearDownCherryPick)

const visible = (locator) => locator.filter({ visible: true }).first()

// How many performers match one custom-field criterion.
async function withField(field, modifier = 'NOT_NULL', value) {
  const { findPerformers } = await gql(
    `query ($f: [CustomFieldCriterionInput!]) {
      findPerformers(filter: { per_page: -1 },
        performer_filter: { custom_fields: $f }) { count }
    }`,
    { f: [{ field, modifier, ...(value ? { value } : {}) }] },
  )
  return findPerformers.count
}

test('one click plays a 16-performer bracket to its champion', async ({
  page,
}) => {
  await page.goto('/performers')
  const bracket = visible(page.locator('.cherrypick-bracket-button'))
  await expect(bracket).toBeVisible({ timeout: 20_000 })
  await bracket.click()
  const play = page.locator('.cherrypick-play-modal')
  await expect(play).toContainText('16 performers')
  // 15 picks in a 16-performer bracket.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(150)
  }
  const result = page.locator('.cherrypick-result-modal')
  await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
  // Every placed performer gets the fields; only the champion has a title.
  await expect
    .poll(() => withField('cherrypick_titles', 'GREATER_THAN', [0]))
    .toBe(1)
  const placed = await withField('cherrypick_best_finish')
  expect(placed).toBeGreaterThan(1)
  expect(placed).toBeLessThanOrEqual(8)
})

test('an anchored bracket hides ratings while you pick and rates only the unrated', async ({
  page,
}) => {
  await page.goto('/performers')
  const bracket = visible(page.locator('.cherrypick-bracket-button'))
  await expect(bracket).toBeVisible({ timeout: 20_000 })
  await bracket.click()
  const play = page.locator('.cherrypick-play-modal')
  await expect(play).toContainText('16 performers')
  await expect(play.locator('.rating-stars, .rating-number')).toHaveCount(0)
  await expect(play.locator('.cherrypick-match')).not.toContainText('seed')
  await expect(play.locator('.cherrypick-match')).not.toContainText('★')
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(150)
  }
  const result = page.locator('.cherrypick-result-modal')
  await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
  // rated performers played, so no one is asked for the champion's stars
  await expect(result.locator('.cherrypick-champ-rate')).toHaveCount(0)
  await result.locator('.cherrypick-apply-open').click()
  const rows = page.locator(
    '.cherrypick-apply-modal .cherrypick-apply-table tbody tr',
  )
  await expect(rows.first()).toBeVisible()
  for (const row of await rows.all()) {
    // only the unrated, each placed by the rated ones around it
    await expect(row.locator('td.num').first()).toHaveText('unrated')
    await expect(row.locator('td').last()).toHaveText(
      /^(Above|Below) .+★( from your scene ratings)?\)|under the champion$/,
    )
  }
})

// Stars as the Apply preview shows a rating100: one decimal
const stars = (r) => (Math.round(r / 2) / 10).toFixed(1)

// The demo plan's average of a performer's rated scenes, as a whole rating100
function sceneAverage(name) {
  const rated = DEMO.scenes
    .filter((s) => s.performers.includes(name) && s.rating100 != null)
    .map((s) => s.rating100)
  return Math.round(rated.reduce((a, b) => a + b, 0) / rated.length)
}

// The performers' ratings in Stash, by id
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

test('performers rated only through their scenes anchor a bracket, and Apply never rates them', async ({
  page,
}) => {
  // Every demo performer unrated; their scenes keep their ratings
  const ids = Object.values(demo.performers)
  const before = await performerRatings(ids)
  for (const id of ids) await setPerformerRating(id, null)
  try {
    await page.goto('/performers')
    const bracket = visible(page.locator('.cherrypick-bracket-button'))
    await expect(bracket).toBeVisible({ timeout: 20_000 })
    await bracket.click()
    const play = page.locator('.cherrypick-play-modal')
    await expect(play).toContainText('16 performers')
    // an anchor looks like any other entrant
    await expect(play.locator('.rating-stars, .rating-number')).toHaveCount(0)
    await expect(play.locator('.cherrypick-match')).not.toContainText('★')
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(150)
    }
    const result = page.locator('.cherrypick-result-modal')
    await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
    // the scene averages anchor it, so no one is asked for the champion's stars
    await expect(result.locator('.cherrypick-champ-rate')).toHaveCount(0)

    await result.locator('.cherrypick-apply-open').click()
    const apply = page.locator('.cherrypick-apply-modal')
    await expect(apply).toContainText("or whose scenes you've rated")
    const rows = apply.locator('.cherrypick-apply-table tbody tr')
    // eight candidates, each against an anchor in the first round; the
    // anchors get no row
    await expect(rows).toHaveCount(8)
    // "Above A (4.3★ from your scene ratings), below B (...)", or one of the two
    const above = /^Above ([^,]+) \((\d\.\d)★ from your scene ratings\)/
    const below =
      /(?:^|, )[Bb]elow ([^,]+) \((\d\.\d)★ from your scene ratings\)$/
    const anchors = new Set()
    const expected = {}
    for (const row of await rows.all()) {
      const name = await row.locator('td').nth(1).innerText()
      await expect(row.locator('td.num').first()).toHaveText('unrated')
      const why = await row.locator('td').last().innerText()
      const [, loName, loStars] = why.match(above) || []
      const [, hiName, hiStars] = why.match(below) || []
      expect(loName || hiName, why).toBeTruthy()
      // each anchor at the average of its scenes' ratings in the demo plan
      const lo = loName && sceneAverage(loName)
      const hi = hiName && sceneAverage(hiName)
      if (loName) expect(stars(lo), why).toBe(loStars)
      if (hiName) expect(stars(hi), why).toBe(hiStars)
      for (const a of [loName, hiName]) if (a) anchors.add(a)
      const to = Math.min(
        100,
        Math.max(
          10,
          loName && hiName
            ? Math.round((lo + hi) / 2 / 5) * 5
            : loName
              ? lo + 10
              : hi - 10,
        ),
      )
      await expect(row.locator('td.num').nth(1)).toHaveText(`${stars(to)}★`)
      expected[name] = to
    }
    // no anchor among the rated
    expect(Object.keys(expected).filter((name) => anchors.has(name))).toEqual(
      [],
    )
    const byId = (byName) =>
      Object.fromEntries(
        Object.entries(byName).map(([name, r]) => [demo.performers[name], r]),
      )

    await apply.locator('.cherrypick-apply-go').click()
    const rated = Object.keys(byId(expected))
    await expect.poll(() => performerRatings(rated)).toEqual(byId(expected))
    // the anchors stay unrated, ready to anchor again
    const anchorIds = [...anchors].map((name) => demo.performers[name])
    expect(Object.values(await performerRatings(anchorIds))).toEqual(
      anchorIds.map(() => null),
    )

    // Undo puts the candidates back to unrated
    await result.locator('.cherrypick-applied button').click()
    await expect
      .poll(async () => Object.values(await performerRatings(rated)))
      .toEqual(rated.map(() => null))
  } finally {
    for (const [id, r] of Object.entries(before))
      await setPerformerRating(id, r)
  }
})

test('a clip bracket pauses and resumes after a reload', async ({ page }) => {
  await page.goto('/scenes')
  const bracket = visible(page.locator('.cherrypick-bracket-button'))
  await expect(bracket).toBeVisible({ timeout: 20_000 })
  await bracket.click()
  const play = page.locator('.cherrypick-play-modal')
  await expect(play).toContainText('16 scenes')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(play).toBeHidden()
  await page.reload()
  const pill = visible(page.locator('.cherrypick-resume-pill'))
  await expect(pill).toBeVisible({ timeout: 20_000 })
  await pill.click()
  await expect(page.locator('.cherrypick-play-modal')).toContainText(
    'match 2 of 8',
  )
})
