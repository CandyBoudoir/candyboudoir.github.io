// Checks New Releases in Stash with its demo (tests/stash.mjs): the first
// visit starts the check and the page fills in as the task saves, the task
// asks the mock ThePornDB politely, cards are Stash's scene cards linking
// to the studios' own pages without tracking, releases carry the user's
// names and say which they have, the filters work and live in the address,
// a second visit asks nothing, a newly favourited studio gets a check of
// its own, and the page explains studios with no link and a Stash with no
// stash-box.
import { expect, test } from '@playwright/test'
import {
  HELD_BY_ID,
  HELD_BY_URL,
  PLUGIN_ID,
  ROUTE,
  TPDB_SCENES,
  TPDB_SITES,
  TPDB_STASH_BOX,
  clearTpdbRequests,
  gql,
  openFilled,
  queuedChecks,
  setBoxes,
  setUpNewReleases,
  tearDownNewReleases,
  tpdbRequests,
  waitForChecks,
} from './stash.mjs'
import { ENDPOINT, STASHDB } from '../../../tests/stash/stashbox-data.mjs'

test.describe.configure({ mode: 'serial' })

let studios
test.beforeAll(async () => {
  test.setTimeout(120_000)
  studios = await setUpNewReleases()
})
test.afterAll(async () => {
  test.setTimeout(120_000)
  await tearDownNewReleases()
})

const card = (page, title) =>
  page.locator('.newreleases-card', {
    has: page.locator('.card-section-title', { hasText: title }),
  })

const TOTAL =
  TPDB_SCENES[TPDB_SITES.lollipop.id].length +
  TPDB_SCENES[TPDB_SITES.gumball.id].length +
  TPDB_SCENES[TPDB_SITES.sleepy.id].length +
  STASHDB.scenes.filter((s) =>
    ['sdb-st-fudge', 'sdb-st-toffee'].includes(s.studio.id),
  ).length

test('the first visit starts a check with Stash’s loader and fills in as it goes', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(ROUTE)
  await expect(
    page.locator('.newreleases-status .LoadingIndicator .spinner-border'),
  ).toBeAttached({ timeout: 15_000 })
  expect(await queuedChecks()).toHaveLength(1)
  await expect(page.locator('.newreleases-status')).toContainText(/Checking/)
  // Cards come in while the check still runs
  await expect(page.locator('.newreleases-card').first()).toBeVisible({
    timeout: 30_000,
  })
  await waitForChecks()
  await expect(page.locator('.newreleases-status')).toHaveText(
    /^Checked just now from (CandyDB and ThePornDB|ThePornDB and CandyDB)\.$/,
    { timeout: 15_000 },
  )
  await expect(page.locator('.newreleases-card')).toHaveCount(TOTAL)
  await expect(page.locator('.paginationIndex')).toHaveText(
    `1-${TOTAL} of ${TOTAL}`,
  )
  expect(errors).toEqual([])
})

test('the check asked ThePornDB one request at a time, with its name and the user’s key', async () => {
  const { requests, maxInFlight } = await tpdbRequests()
  expect(maxInFlight).toBe(1)
  // Stash lists favourites by name, and the task asks in that order
  expect(requests.map((r) => `${r.path}${r.query}`)).toEqual(
    ['gumball', 'lollipop', 'sleepy'].flatMap((key) => [
      `/sites/${TPDB_SITES[key].uuid}`,
      `/scenes?site_id=${TPDB_SITES[key].id}&per_page=25&orderBy=recently_released`,
    ]),
  )
  for (const r of requests) {
    expect(r.authorization).toBe(`Bearer ${TPDB_STASH_BOX.api_key}`)
    expect(r.userAgent).toMatch(
      /^NewReleases\/0\.1\.0 \(Stash plugin; \+https:\/\/github\.com\/CandyBoudoir\//,
    )
  }
  for (let i = 1; i < requests.length; i++)
    expect(requests[i].start - requests[i - 1].end).toBeGreaterThanOrEqual(400)
})

test('Stash renders the elements the page builds on', async ({ page }) => {
  await openFilled(page)
  for (const selector of [
    '.top-nav .newreleases-nav .nav-menu-icon',
    '.filtered-list-toolbar',
    '.react-select__control',
    '.paginationIndex',
    '.newreleases-card.grid-card.scene-card',
    '.newreleases-card .thumbnail-section',
    '.newreleases-card .scene-card-preview-image',
    '.newreleases-card .studio-overlay a',
    '.newreleases-card .scene-specs-overlay .overlay-duration',
    '.newreleases-card .card-section-title',
    '.newreleases-card .scene-card__date',
    '.newreleases-card .tag-item.badge',
  ])
    await expect.soft(page.locator(selector).first(), selector).toBeAttached()
  // The duration sits on the cover, as on Stash's own cards
  const lullaby = card(page, 'Lollipop Lullaby')
  const cover = await lullaby.locator('.thumbnail-section').boundingBox()
  const duration = await lullaby.locator('.overlay-duration').boundingBox()
  expect(duration.y + duration.height).toBeLessThanOrEqual(
    cover.y + cover.height,
  )
})

test('a card opens the release on the studio’s own page in a new tab, with no tracking', async ({
  page,
}) => {
  await openFilled(page)
  const link = card(page, 'Lollipop Lullaby').locator('a.scene-card-link')
  await expect(link).toHaveAttribute(
    'href',
    'https://lollipop-lounge.example/clips/lollipop-lullaby',
  )
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  // A stash-box scene sold on a clip store links to the store, minus its
  // affiliate code
  const toffee = STASHDB.scenes.find((s) => s.studio.id === 'sdb-st-toffee')
  await expect(
    card(page, toffee.title).locator('a.scene-card-link'),
  ).toHaveAttribute('href', `https://clips.example/clip/${toffee.id}`)
  // The studio is the user's own
  await expect(
    card(page, 'Lollipop Lullaby').locator('.studio-overlay a'),
  ).toHaveAttribute('href', `/studios/${studios['Lollipop Lounge']}`)
})

test('releases carry the user’s names for performers and tags', async ({
  page,
}) => {
  await openFilled(page)
  // ThePornDB credits her as "Bijou" and files her under Bonbon Bijou
  await expect(
    card(page, 'Cherry Cordial').locator('.newreleases-performer'),
  ).toHaveText(['Bonbon Bijou'])
  await expect(
    card(page, 'Lollipop Lullaby').locator('.newreleases-performer'),
  ).toHaveText(['Gumdrop Gigi', 'Peppermint Patti'])
  await expect(card(page, 'Lollipop Lullaby').locator('.tag-item')).toHaveText([
    'Candy',
    'Pastel',
    'Sprinkles',
  ])
})

test('releases you have are marked, link to your scene and can be hidden', async ({
  page,
}) => {
  await openFilled(page)
  const owned = page.locator('.newreleases-owned')
  await expect(owned).toHaveCount(2)
  await expect(card(page, HELD_BY_ID.title)).toHaveClass(/newreleases-owned/)
  await expect(card(page, HELD_BY_URL.title)).toHaveClass(/newreleases-owned/)
  const { findScenes } = await gql(
    '{ findScenes(filter: { per_page: -1 }) { scenes { id title } } }',
  )
  const held = findScenes.scenes.find((s) => s.title === HELD_BY_ID.title)
  await expect(
    card(page, HELD_BY_ID.title).locator('.newreleases-owned-badge'),
  ).toHaveAttribute('href', `/scenes/${held.id}`)

  await page.getByRole('button', { name: 'Hide what I have' }).click()
  await expect(owned).toHaveCount(0)
  await expect(page.locator('.newreleases-card')).toHaveCount(TOTAL - 2)
  expect(new URL(page.url()).searchParams.get('owned')).toBe('hide')
  await page.reload()
  await expect(page.locator('.newreleases-card')).toHaveCount(TOTAL - 2)
  await expect(
    page.getByRole('button', { name: 'Hide what I have' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('filters by studio, performer and tag, with and without, kept in the address', async ({
  page,
}) => {
  await openFilled(page, `${ROUTE}?studio=${studios['Lollipop Lounge']}`)
  await expect(page.locator('.newreleases-card')).toHaveCount(
    TPDB_SCENES[TPDB_SITES.lollipop.id].length,
  )
  await expect(page.locator('.studio-overlay')).toHaveText(
    Array(TPDB_SCENES[TPDB_SITES.lollipop.id].length).fill('Lollipop Lounge'),
  )

  // A performer on a card filters by them, by the user's own id
  await page.goto(ROUTE)
  await card(page, 'Lollipop Lullaby')
    .getByRole('button', { name: 'Peppermint Patti' })
    .click()
  const { findPerformers } = await gql(
    '{ findPerformers(performer_filter: { name: { value: "Peppermint Patti", modifier: EQUALS } }) { performers { id } } }',
  )
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll('performer'))
    .toEqual([findPerformers.performers[0].id])
  const patti = page.locator('.newreleases-card')
  await expect(patti.first()).toBeVisible()
  for (const names of await patti
    .locator('.newreleases-performers')
    .allInnerTexts())
    expect(names).toContain('Peppermint Patti')

  // Without a tag, from the Tags select's Without group
  await page.goto(ROUTE)
  await page.locator('#newreleases-tags').fill('Sour')
  await page
    .locator('.react-select__group', { hasText: 'Without' })
    .locator('.react-select__option', { hasText: 'Sour' })
    .click()
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll('tag'))
    .toEqual(['-~sour'])
  await expect(page.locator('.newreleases-card').first()).toBeVisible()
  await expect(
    page.locator('.newreleases-card .tag-item', { hasText: /^Sour$/ }),
  ).toHaveCount(0)
  await expect(page.locator('.react-select__multi-value')).toHaveText([
    'without Sour',
  ])

  // A tag on a card adds itself; Clear filters takes everything off
  await card(page, 'Lollipop Lullaby')
    .getByRole('button', { name: 'Sprinkles' })
    .click()
  await expect(page.locator('.newreleases-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.newreleases-card')).toHaveCount(TOTAL)
  expect(new URL(page.url()).search).toBe('')

  // An empty result is Stash's empty list
  await page.goto(`${ROUTE}?tag=~sour&tag=~sprinkles`)
  await expect(page.locator('.paginationIndex')).toHaveText('0-0 of 0')
})

test('a second visit shows the catalog at once and asks nothing', async ({
  page,
}) => {
  await clearTpdbRequests()
  await page.goto(ROUTE)
  await expect(page.locator('.newreleases-card')).toHaveCount(TOTAL)
  await page.waitForTimeout(1500)
  expect(await queuedChecks()).toHaveLength(0)
  expect((await tpdbRequests()).requests).toEqual([])
})

test('a newly favourited studio gets a check on the next visit', async ({
  page,
}) => {
  const { findStudios } = await gql(
    '{ findStudios(studio_filter: { name: { value: "Pop Club", modifier: EQUALS } }) { studios { id } } }',
  )
  const pop = findStudios.studios[0].id
  const favourite = (on) =>
    gql(
      'mutation ($i: StudioUpdateInput!) { studioUpdate(input: $i) { id } }',
      {
        i: { id: pop, favorite: on },
      },
    )
  await favourite(true)
  try {
    await page.goto(ROUTE)
    await expect(page.locator('.newreleases-status')).toContainText(
      /Checking/,
      {
        timeout: 15_000,
      },
    )
    await waitForChecks()
    const catalog = await (
      await page.request.get(`/plugin/${PLUGIN_ID}/assets/catalog/catalog.json`)
    ).json()
    expect(catalog.run.favourites).toContain(pop)
    expect(catalog.studios[pop].endpoint).toBe(ENDPOINT)
    // Only Pop Club was due: ThePornDB was not asked again
    expect((await tpdbRequests()).requests).toEqual([])
  } finally {
    await favourite(false)
  }
})

test('favourites with no stash-box link point to the studio Tagger', async ({
  page,
}) => {
  await openFilled(page)
  const note = page.locator('.newreleases-notes li', {
    hasText: 'Mystery Mints',
  })
  await expect(note).toContainText('no link to a stash-box')
  await expect(
    note.getByRole('link', { name: 'studio Tagger' }),
  ).toHaveAttribute('href', '/studios?disp=3')
})

test('with no stash-box set up, the page says so in one line', async ({
  page,
}) => {
  const { configuration } = await gql(
    '{ configuration { general { stashBoxes { name endpoint api_key } } } }',
  )
  await setBoxes([])
  try {
    await page.goto(ROUTE)
    await expect(page.locator('.newreleases-notes li')).toHaveText(
      /Stash has none set up\. Add one in Settings › Metadata Providers\./,
    )
    await expect(page.locator('.newreleases-card')).toHaveCount(0)
    expect(await queuedChecks()).toHaveLength(0)
  } finally {
    await setBoxes(configuration.general.stashBoxes)
  }
})

test('the menu entry opens the page and shows it open', async ({ page }) => {
  await page.goto('/scenes')
  const entry = page.locator('.top-nav .newreleases-nav button')
  await expect(entry).toHaveText('New Releases')
  await expect(entry).not.toHaveClass(/\bactive\b/)
  await entry.click()
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`))
  await expect(entry).toHaveClass(/\bactive\b/)
})

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  test('the page fits a phone screen', async ({ page }) => {
    await openFilled(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBe(0)
  })
})
