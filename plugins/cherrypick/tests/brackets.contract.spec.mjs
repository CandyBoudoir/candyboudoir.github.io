// Checks Cherry Pick's brackets in Stash: the Bracket button beside the
// Performers and Scenes lists, a bracket played to its champion with the
// keyboard, the custom fields written at the end, no ratings while you pick,
// Apply's ratings for the unrated only, and pause and resume.
import { expect, test } from '@playwright/test'
import { gql, setUpCherryPick, tearDownCherryPick } from './stash.mjs'

test.beforeAll(setUpCherryPick)
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
      /^(Above|Below) .+★\)|under the champion$/,
    )
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
