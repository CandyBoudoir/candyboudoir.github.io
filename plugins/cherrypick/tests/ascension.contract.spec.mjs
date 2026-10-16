// Cherry Pick beside Ascension 1.4.1, the Elo ranking plugin. Runs when
// prepare.mjs installed it (COMPANIONS=ascension); skipped otherwise. Both
// plugins' pieces render on the pages they share, nothing throws, their
// badges don't overlap, and Apply never writes over a performer Ascension
// ranks and says Ascension will pick up what it sets.
import { expect, test } from '@playwright/test'
import { companionPluginIds } from '../../../tests/stash/companions.mjs'
import {
  forYouCards,
  gql,
  setUpCherryPick,
  tearDownCherryPick,
} from './stash.mjs'

// What Ascension writes on a performer after a few matches
const RANKED = {
  hotornot_stats: JSON.stringify({
    total_matches: 4,
    wins: 3,
    losses: 1,
    draws: 0,
    current_streak: 2,
  }),
  performer_record: JSON.stringify([
    { date: '2026-10-15T20:00:00.000Z', opponentId: '1', won: true },
  ]),
}

async function rankEveryPerformer(on) {
  const { findPerformers } = await gql(
    '{ findPerformers(filter: { per_page: -1 }) { performers { id } } }',
  )
  for (const { id } of findPerformers.performers)
    await gql(
      'mutation ($i: PerformerUpdateInput!) { performerUpdate(input: $i) { id } }',
      {
        i: {
          id,
          custom_fields: on
            ? { partial: RANKED }
            : { remove: Object.keys(RANKED) },
        },
      },
    )
}

async function performerRatings() {
  const { findPerformers } = await gql(
    '{ findPerformers(filter: { per_page: -1 }) { performers { id rating100 } } }',
  )
  return Object.fromEntries(
    findPerformers.performers.map((p) => [p.id, p.rating100]),
  )
}

// Ascension's score on each card, against Stash's rating banner and every
// piece of Cherry Pick's on the same card: the pairs that overlap
const overlaps = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      const b = el.getBoundingClientRect()
      return b.width && b.height && getComputedStyle(el).visibility !== 'hidden'
        ? b
        : null
    }
    const hit = (a, b) =>
      a.left < b.right &&
      b.left < a.right &&
      a.top < b.bottom &&
      b.top < a.bottom
    const out = []
    for (const card of document.querySelectorAll(
      '.scene-card, .performer-card',
    )) {
      const theirs = [...card.querySelectorAll('.hon-asc-score-display')]
        .map(box)
        .filter(Boolean)
      const ours = [
        ...card.querySelectorAll(
          '.cherrypick-score-banner, .cherrypick-honours, .rating-banner',
        ),
      ]
        .map((el) => [el.className, box(el)])
        .filter(([, b]) => b)
      for (const a of theirs)
        for (const [cls, b] of ours) if (hit(a, b)) out.push(cls)
    }
    return out
  })

// Plays a 16-performer bracket from the Performers list to its champion
async function playBracket(page) {
  await page.goto('/performers')
  const bracket = page
    .locator('.cherrypick-bracket-button')
    .filter({ visible: true })
    .first()
  await expect(bracket).toBeVisible({ timeout: 20_000 })
  await bracket.click()
  await expect(page.locator('.cherrypick-play-modal')).toContainText(
    '16 performers',
  )
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(150)
  }
  const result = page.locator('.cherrypick-result-modal')
  await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
  return result
}

test.describe('beside Ascension', () => {
  test.skip(
    !companionPluginIds().includes('ascension'),
    'Ascension is not installed (COMPANIONS=ascension)',
  )

  let demo
  test.beforeAll(async () => {
    ;({ demo } = await setUpCherryPick())
  })
  test.afterAll(async () => {
    await rankEveryPerformer(false)
    await tearDownCherryPick()
  })

  test('both plugins render on the pages they share, apart and error-free', async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
    const ascension = page.locator('.hon-asc-score-display').first()

    await page.goto('/')
    await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
    await expect(
      forYouCards(page).first().locator('.hon-asc-score-display'),
    ).toBeVisible({ timeout: 20_000 })
    expect(await overlaps(page)).toEqual([])

    // Ascension hides the first .rating-banner on each card, Stash's rating
    // as it expects; on an unrated scene that is Your score, which stays.
    await page.goto('/scenes?sortby=title&perPage=120')
    const badge = page.locator('.cherrypick-score-banner').first()
    await expect(badge).toBeVisible({ timeout: 20_000 })
    await expect(
      page
        .locator('.scene-card', { has: badge })
        .first()
        .locator('.hon-asc-score-display'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.locator('.cherrypick-bracket-button').filter({ visible: true }),
    ).toHaveCount(1)
    expect(await overlaps(page)).toEqual([])

    await page.goto('/performers')
    await expect(ascension).toBeVisible({ timeout: 20_000 })
    await expect(
      page.locator('.cherrypick-bracket-button').filter({ visible: true }),
    ).toHaveCount(1)
    expect(await overlaps(page)).toEqual([])

    await page.goto(`/performers/${Object.values(demo.performers)[0]}`)
    await expect(
      page.locator('.detail-header .hon-asc-score-display'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.locator('.detail-item.cherrypick-performer-line'),
    ).toBeVisible({ timeout: 20_000 })
    expect(await overlaps(page)).toEqual([])

    expect(errors).toEqual([])
  })

  test('Apply leaves every performer Ascension ranks alone, and says why', async ({
    page,
  }) => {
    await rankEveryPerformer(true)
    const before = await performerRatings()
    const result = await playBracket(page)
    await result.locator('.cherrypick-apply-open').click()
    const apply = page.locator('.cherrypick-apply-modal')
    await expect(apply.locator('.cherrypick-apply-ranking')).toContainText(
      'Ascension is installed',
    )
    const rows = apply.locator('.cherrypick-apply-table tbody tr')
    await expect(rows).toHaveCount(8)
    await expect(apply.locator('.cherrypick-apply-skipped')).toHaveCount(8)
    await expect(rows.first()).toContainText('Ascension ranks them')
    await expect(apply.locator('.cherrypick-apply-go')).toBeDisabled()
    expect(await performerRatings()).toEqual(before)

    // The champion's crown sits clear of Ascension's score
    await page.keyboard.press('Escape')
    await page.goto('/performers?perPage=120')
    await expect(
      page.locator('.performer-card .cherrypick-honours').first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.hon-asc-score-display').first()).toBeVisible()
    expect(await overlaps(page)).toEqual([])
    await rankEveryPerformer(false)
  })

  test('Apply checks again right before it writes', async ({ page }) => {
    const result = await playBracket(page)
    await result.locator('.cherrypick-apply-open').click()
    const apply = page.locator('.cherrypick-apply-modal')
    const go = apply.locator('.cherrypick-apply-go')
    if (await go.isDisabled()) await apply.locator('label').first().click()
    await expect(go).toBeEnabled()
    // Ascension ranks them all while the preview is open
    await rankEveryPerformer(true)
    const before = await performerRatings()
    await go.click()
    await expect(page.locator('.cherrypick-applied').first()).toContainText(
      'Ascension or HotOrNot ranks',
    )
    expect(await performerRatings()).toEqual(before)
    await rankEveryPerformer(false)
  })
})
