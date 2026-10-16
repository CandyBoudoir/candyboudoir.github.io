// Cherry Pick beside the plugins the compatibility tests can install
// (companions.mjs): the Elo ranking plugins Ascension 1.4.1 and HotOrNot
// 1.0.0, and Stash Curator 0.36.0. Each block runs when prepare.mjs installed
// its plugin alone (COMPANIONS=ascension, hotornot or curator) and is skipped
// otherwise: Ascension is a fork of HotOrNot and the two claim the same
// element ids, so they fight over a performer's page whatever Cherry Pick
// does. Beside a ranking plugin, both plugins' pieces render on the pages
// they share, nothing throws, they don't overlap, a dialog's buttons are
// never covered, and Apply never writes over a performer the other plugin
// ranks and says that plugin will pick up what it sets. Beside Curator, whose
// patches change the list components' arguments and whose criteria Stash's
// schema lacks, the lists render and Bracket works on a list it filters.
import { expect, test } from '@playwright/test'
import { companionPluginIds } from '../../../tests/stash/companions.mjs'
import {
  forYouCards,
  gql,
  PLUGIN_ID,
  setPluginSettings,
  setUpCherryPick,
  tearDownCherryPick,
} from './stash.mjs'

// What each plugin writes on a performer after a few matches, the pieces it
// puts on the pages Cherry Pick also decorates, and where. `theirs` matches
// everything of its own on the page; `seen` says what each page shows.
const SIDE = {
  ascension: {
    name: 'Ascension',
    ranked: {
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
    },
    theirs: '.hon-asc-score-display',
    seen: {
      front: (page) =>
        forYouCards(page).first().locator('.hon-asc-score-display'),
      // Ascension hides the first .rating-banner on each card, Stash's
      // rating as it expects; on an unrated scene that is Your score,
      // which stays.
      scenes: (page) =>
        page
          .locator('.scene-card', {
            has: page.locator('.cherrypick-score-banner'),
          })
          .first()
          .locator('.hon-asc-score-display'),
      performers: (page) => page.locator('.hon-asc-score-display').first(),
      performer: (page) =>
        page.locator('.detail-header .hon-asc-score-display'),
    },
  },
  hotornot: {
    name: 'HotOrNot',
    // As one match leaves a performer: hotornot_stats alone
    ranked: {
      hotornot_stats: JSON.stringify({
        total_matches: 4,
        last_match: '2026-10-15T20:00:00.000Z',
        wins: 3,
        losses: 1,
        current_streak: 2,
        best_streak: 2,
        worst_streak: 0,
      }),
    },
    theirs: '#hon-floating-btn, #hon-battle-rank-badge',
    seen: {
      // A fixed button on the Performers and Images pages, above Stash's
      // modals, and a rank badge beside the rating on a performer's page
      performers: (page) => page.locator('#hon-floating-btn'),
      performer: (page) => page.locator('#hon-battle-rank-badge'),
    },
    // One match in its own dialog, the left performer winning. It draws a
    // gender at random from every chip but Male, and the demo performers
    // are all Female, so the others come off first.
    play: async (page) => {
      await page.goto('/performers')
      await page.locator('#hon-floating-btn').click()
      for (const g of [
        'TRANSGENDER_MALE',
        'TRANSGENDER_FEMALE',
        'INTERSEX',
        'NON_BINARY',
      ])
        await page
          .locator(`#hon-modal .hon-gender-btn[data-gender="${g}"]`)
          .click()
      await page
        .locator('#hon-modal .hon-scene-card[data-side="left"] .hon-scene-body')
        .click()
      await page.locator('#hon-modal .hon-modal-close').click()
    },
  },
}

// Performers by id, with the rating and the fields a ranking plugin writes
async function performerState() {
  const { findPerformers } = await gql(
    '{ findPerformers(filter: { per_page: -1 }) { performers { id rating100 custom_fields } } }',
  )
  return Object.fromEntries(findPerformers.performers.map((p) => [p.id, p]))
}

const rankedKeys = (side) => Object.keys(side.ranked)

async function rankEveryPerformer(side, on) {
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
            ? { partial: side.ranked }
            : { remove: rankedKeys(side) },
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

// The pairs of the other plugin's pieces and Cherry Pick's, on the same
// page, that overlap
const overlaps = (page, theirs) =>
  page.evaluate((theirs) => {
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
    const ours = [
      ...document.querySelectorAll(
        '.cherrypick-score-banner, .cherrypick-honours, .cherrypick-performer-line, .cherrypick-bracket-slot, .rating-banner',
      ),
    ]
      .map((el) => [el.className, box(el)])
      .filter(([, b]) => b)
    const out = []
    for (const el of document.querySelectorAll(theirs)) {
      const a = box(el)
      if (a)
        for (const [cls, b] of ours)
          if (hit(a, b)) out.push(`${el.id || el.className} on ${cls}`)
    }
    return out
  }, theirs)

// The buttons, links and fields of Cherry Pick's open dialogs that a piece of
// the other plugin sits on top of, at any of nine points across each one
const covered = (page, theirs) =>
  page.evaluate((theirs) => {
    const out = new Set()
    for (const el of document.querySelectorAll(
      '.cherrypick-dialog button, .cherrypick-dialog a[href], .cherrypick-dialog input, .cherrypick-dialog label',
    )) {
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height) continue
      const points = [0.05, 0.5, 0.95].flatMap((x) =>
        [0.15, 0.5, 0.85].map((y) => [
          b.left + b.width * x,
          b.top + b.height * y,
        ]),
      )
      if (
        points.some(([x, y]) =>
          document.elementFromPoint(x, y)?.closest(theirs),
        )
      )
        out.add(
          `${el.textContent.trim().slice(0, 30)} (${el.tagName.toLowerCase()})`,
        )
    }
    return [...out]
  }, theirs)

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

for (const [key, side] of Object.entries(SIDE)) {
  test.describe(`beside ${side.name}`, () => {
    test.skip(
      companionPluginIds().length !== 1 || !companionPluginIds().includes(key),
      `${side.name} is not installed alone (COMPANIONS=${key})`,
    )

    let demo
    test.beforeAll(async () => {
      ;({ demo } = await setUpCherryPick())
    })
    test.afterAll(async () => {
      await rankEveryPerformer(side, false)
      await tearDownCherryPick()
    })

    test('both plugins render on the pages they share, apart and error-free', async ({
      page,
    }) => {
      const errors = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
      const seen = async (where) => {
        if (side.seen[where])
          await expect(side.seen[where](page)).toBeVisible({
            timeout: 20_000,
          })
      }

      await page.goto('/')
      await expect(forYouCards(page).first()).toBeVisible({ timeout: 20_000 })
      await seen('front')
      expect(await overlaps(page, side.theirs)).toEqual([])

      await page.goto('/scenes?sortby=title&perPage=120')
      await expect(
        page.locator('.cherrypick-score-banner').first(),
      ).toBeVisible({ timeout: 20_000 })
      await seen('scenes')
      await expect(
        page.locator('.cherrypick-bracket-button').filter({ visible: true }),
      ).toHaveCount(1)
      expect(await overlaps(page, side.theirs)).toEqual([])

      await page.goto('/performers')
      await seen('performers')
      await expect(
        page.locator('.cherrypick-bracket-button').filter({ visible: true }),
      ).toHaveCount(1)
      expect(await overlaps(page, side.theirs)).toEqual([])

      await page.goto(`/performers/${Object.values(demo.performers)[0]}`)
      await seen('performer')
      await expect(
        page.locator('.detail-item.cherrypick-performer-line'),
      ).toBeVisible({ timeout: 20_000 })
      expect(await overlaps(page, side.theirs)).toEqual([])

      expect(errors).toEqual([])
    })

    test('a match in its own dialog leaves what Apply looks for, and the page still works', async ({
      page,
    }) => {
      test.skip(!side.play, `${side.name}'s dialog is not scripted`)
      const errors = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
      const before = await performerState()
      await side.play(page)
      const ranked = () =>
        performerState().then((now) =>
          Object.values(now).filter(
            (p) =>
              p.custom_fields?.hotornot_stats &&
              !before[p.id].custom_fields?.hotornot_stats,
          ),
        )
      await expect.poll(async () => (await ranked()).length).toBeGreaterThan(0)
      const now = await ranked()
      // Its record is what the fixtures say it is
      for (const p of now)
        expect(
          Object.keys(JSON.parse(p.custom_fields.hotornot_stats)).sort(),
        ).toEqual(Object.keys(JSON.parse(side.ranked.hotornot_stats)).sort())
      // Put the ratings back
      for (const p of now)
        await gql(
          'mutation ($i: PerformerUpdateInput!) { performerUpdate(input: $i) { id } }',
          {
            i: {
              id: p.id,
              rating100: before[p.id].rating100,
              custom_fields: { remove: rankedKeys(side) },
            },
          },
        )
      await page.goto('/performers')
      await expect(
        page.locator('.cherrypick-bracket-button').filter({ visible: true }),
      ).toHaveCount(1, {
        timeout: 20_000,
      })
      expect(errors).toEqual([])
    })

    test('Apply leaves every performer it ranks alone, and says why', async ({
      page,
    }) => {
      await rankEveryPerformer(side, true)
      const before = await performerRatings()
      const result = await playBracket(page)
      await result.locator('.cherrypick-apply-open').click()
      const apply = page.locator('.cherrypick-apply-modal')
      await expect(apply.locator('.cherrypick-apply-ranking')).toContainText(
        side.name,
      )
      await expect(apply.locator('.cherrypick-apply-ranking')).toContainText(
        'installed',
      )
      const rows = apply.locator('.cherrypick-apply-table tbody tr')
      await expect(rows).toHaveCount(8)
      await expect(apply.locator('.cherrypick-apply-skipped')).toHaveCount(8)
      await expect(rows.first()).toContainText(`${side.name} ranks them`)
      await expect(apply.locator('.cherrypick-apply-go')).toBeDisabled()
      expect(await performerRatings()).toEqual(before)

      // The champion's crown sits clear of the other plugin's pieces
      await page.keyboard.press('Escape')
      await page.goto('/performers?perPage=120')
      await expect(
        page.locator('.performer-card .cherrypick-honours').first(),
      ).toBeVisible({ timeout: 20_000 })
      expect(await overlaps(page, side.theirs)).toEqual([])
      await rankEveryPerformer(side, false)
    })

    test('Apply checks again right before it writes', async ({ page }) => {
      const result = await playBracket(page)
      await result.locator('.cherrypick-apply-open').click()
      const apply = page.locator('.cherrypick-apply-modal')
      const go = apply.locator('.cherrypick-apply-go')
      if (await go.isDisabled()) await apply.locator('label').first().click()
      await expect(go).toBeEnabled()
      // The other plugin ranks them all while the preview is open
      await rankEveryPerformer(side, true)
      const before = await performerRatings()
      await go.click()
      await expect(page.locator('.cherrypick-applied').first()).toContainText(
        'Ascension or HotOrNot ranks',
      )
      expect(await performerRatings()).toEqual(before)
      await rankEveryPerformer(side, false)
    })

    test.describe('at phone width', () => {
      test.use({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      })

      test("a bracket's dialogs keep every button clear of it", async ({
        page,
      }) => {
        await page.goto('/performers')
        await expect(
          page.locator('.cherrypick-bracket-button').filter({ visible: true }),
        ).toHaveCount(1, { timeout: 20_000 })
        await page
          .locator('.cherrypick-bracket-button')
          .filter({ visible: true })
          .click()
        const play = page.locator('.cherrypick-play-modal')
        await expect(play).toContainText('16 performers')
        expect(await covered(page, side.theirs)).toEqual([])
        for (let i = 0; i < 15; i++) {
          await page.keyboard.press('ArrowLeft')
          await page.waitForTimeout(150)
        }
        const result = page.locator('.cherrypick-result-modal')
        await expect(result.locator('.cherrypick-champ-name')).not.toBeEmpty()
        expect(await covered(page, side.theirs)).toEqual([])
        await result.locator('.cherrypick-apply-open').click()
        await expect(page.locator('.cherrypick-apply-modal')).toBeVisible()
        expect(await covered(page, side.theirs)).toEqual([])
      })
    })
  })
}

// A list filtered on one of Curator's criteria, "is greater than 0", in
// Stash's URL encoding
const curatorFilter = (path, type) =>
  `${path}?c=(%22type%22:%22${type}%22,%22modifier%22:%22GREATER_THAN%22,%22value%22:%220%22)`

// Curator's pieces on Stash's own cards and its controls on a list
const CURATOR = '.curator-scene-card-badge, .curator-performer-card-badge'

// Stash's answers that rejected a query outright, as "400 CherryPickListScenes"
function rejected(page) {
  const out = []
  page.on('response', (r) => {
    if (r.url().endsWith('/graphql') && r.status() === 400)
      out.push(`400 ${r.request().postDataJSON()?.operationName}`)
  })
  return out
}

test.describe('beside Stash Curator', () => {
  test.skip(
    companionPluginIds().length !== 1 ||
      !companionPluginIds().includes('stash-curator'),
    'Stash Curator is not installed alone (COMPANIONS=curator)',
  )

  let demo
  test.beforeAll(async () => {
    ;({ demo } = await setUpCherryPick())
    // Curator scores what its last sync saw: the demo library's plays
    await gql(
      'mutation { runPluginTask(plugin_id: "stash-curator", task_name: "Sync and build recommendations") }',
    )
    await expect
      .poll(async () => (await gql('{ jobQueue { id } }')).jobQueue?.length, {
        timeout: 120_000,
      })
      .toBeFalsy()
  })
  test.afterAll(tearDownCherryPick)
  // A bracket left paused hides the list's Bracket button
  test.beforeEach(() => setPluginSettings(PLUGIN_ID, {}))

  test('both lists render, with both plugins on their cards and apart', async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
    const bracket = page
      .locator('.cherrypick-bracket-button')
      .filter({ visible: true })

    await page.goto('/scenes?sortby=title&perPage=120')
    await expect(page.locator('.scene-card').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page.locator('.scene-card .curator-scene-card-badge').first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.locator('.scene-card .cherrypick-score-banner').first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(bracket).toHaveCount(1)
    expect(await overlaps(page, CURATOR)).toEqual([])

    await page.goto('/performers')
    await expect(
      page.locator('.performer-card .curator-performer-card-badge').first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(bracket).toHaveCount(1, { timeout: 20_000 })
    expect(await overlaps(page, CURATOR)).toEqual([])

    // A performer's Scenes tab is the same scene list
    await page.goto(`/performers/${Object.values(demo.performers)[0]}/scenes`)
    await expect(page.locator('.scene-card').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page.locator('.detail-item.cherrypick-performer-line'),
    ).toBeVisible({ timeout: 20_000 })

    expect(errors).toEqual([])
  })

  test('Bracket on a Scenes list filtered by Curator Appeal leaves it out and says so', async ({
    page,
  }) => {
    const bad = rejected(page)
    await page.goto(curatorFilter('/scenes', 'curator_appeal'))
    await expect(page.locator('.scene-card').first()).toBeVisible({
      timeout: 20_000,
    })
    const bracket = page
      .locator('.cherrypick-bracket-button')
      .filter({ visible: true })
    await expect(bracket).toBeEnabled({ timeout: 20_000 })
    await expect(bracket).toHaveAttribute(
      'title',
      /watched scenes in this list · Curator Appeal not applied$/,
    )
    await bracket.click()
    await expect(page.locator('.cherrypick-play-modal')).toContainText(
      'Curator Appeal not applied',
    )
    expect(bad).toEqual([])
  })

  test('Bracket on a Performers list filtered by Curator affinity leaves it out and says so', async ({
    page,
  }) => {
    const bad = rejected(page)
    await page.goto(curatorFilter('/performers', 'curator_affinity'))
    await expect(page.locator('.performer-card').first()).toBeVisible({
      timeout: 20_000,
    })
    const bracket = page
      .locator('.cherrypick-bracket-button')
      .filter({ visible: true })
    await expect(bracket).toBeEnabled({ timeout: 20_000 })
    await expect(bracket).toHaveAttribute(
      'title',
      'Bracket the performers in this list · Curator affinity not applied',
    )
    await bracket.click()
    await expect(page.locator('.cherrypick-play-modal')).toContainText(
      'Curator affinity not applied',
    )
    expect(bad).toEqual([])
  })

  test("Bracket says why when Stash rejects the list's filter", async ({
    page,
  }) => {
    // Without Stash's filter fields, Curator's key goes to Stash as it is
    await page.route('**/graphql', (route) =>
      route.request().postDataJSON()?.operationName === 'CherryPickFilterFields'
        ? route.fulfill({ status: 500, body: '' })
        : route.fallback(),
    )
    await page.goto(curatorFilter('/scenes', 'curator_appeal'))
    const bracket = page
      .locator('.cherrypick-bracket-button')
      .filter({ visible: true })
    await expect(bracket).toHaveAttribute(
      'title',
      "Can't bracket this list: unknown field (scene_filter.curator_appeal)",
      { timeout: 20_000 },
    )
    await expect(bracket).toBeDisabled()

    await page.goto(curatorFilter('/performers', 'curator_affinity'))
    await expect(bracket).toHaveAttribute(
      'title',
      "Can't bracket this list: unknown field (performer_filter.curator_affinity)",
      { timeout: 20_000 },
    )
    await expect(bracket).toBeDisabled()
  })
})
