// Checks New Releases in Stash with its demo (tests/stash.mjs): the first
// visit starts the check and the list fills in, in order, as the task saves
// each studio; the task asks the mock ThePornDB politely and keeps the last
// 48 hours; cards are Stash's scene cards with landscape covers and
// descriptions, linking to the studios' own pages without tracking;
// releases carry the user's names and the ones they have never show; the
// filters, Stash's sorts and pagination live in the address; a second visit
// asks nothing, a newly favourited studio gets a check of its own, a check
// while the page is open puts what it finds in Just in, New, and leaves the
// list still, and the page explains studios with no link and a Stash with
// no stash-box.
import { expect, test } from '@playwright/test'
import {
  HELD_BY_ID,
  HELD_BY_URL,
  PLUGIN_ID,
  ROUTE,
  SHOWN,
  TEST_SETTINGS,
  TPDB_SITES,
  TPDB_STASH_BOX,
  ageCatalog,
  clearTpdbRequests,
  gql,
  lateRelease,
  openFilled,
  publishLate,
  queuedChecks,
  setBoxes,
  setPluginSettings,
  setUpNewReleases,
  tearDownNewReleases,
  tpdbFresh,
  tpdbRequests,
  waitForChecks,
  withdrawLate,
} from './stash.mjs'
import { readFile } from 'node:fs/promises'
import { SORTS } from '../src/js/data/sort.js'

// The version the manifest gives, which the task names itself with
const VERSION = /^version: (.+)$/m.exec(
  await readFile(new URL('../src/NewReleases.yml', import.meta.url), 'utf8'),
)[1]
import { ENDPOINT } from '../../../tests/stash/stashbox-data.mjs'

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

// The list's cards, below Just in
const card = (page, title) =>
  page.locator('.newreleases-grid .newreleases-card', {
    has: page.locator('.card-section-title', { hasText: title }),
  })
const titles = (page) =>
  page
    .locator('.newreleases-grid .newreleases-card .card-section-title')
    .allInnerTexts()
// Just in's cards, without the copies Stash's slider makes to loop
const justInTitles = (page) =>
  page
    .locator(
      '.newreleases-just-in .slick-slide:not(.slick-cloned) .card-section-title',
    )
    .allInnerTexts()

// Names in Stash's natural order, case aside
const byName = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
const newestFirst = (list) =>
  [...list].sort(
    (a, b) => b.date.localeCompare(a.date) || byName(a.title, b.title),
  )
const fresh = (site) =>
  newestFirst(
    tpdbFresh(site).filter((s) => s !== HELD_BY_ID && s !== HELD_BY_URL),
  ).map((s) => s.title)

test('the first visit starts a check with Stash’s loader and fills the list in order as each studio arrives', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // A pause long enough that the page, reading the catalog every 2.5 s,
  // sees Gumball Gallery's releases before Lollipop Lounge's
  await setPluginSettings(PLUGIN_ID, { ...TEST_SETTINGS, pauseSeconds: 1.5 })
  await page.goto(ROUTE)
  await expect(
    page.locator('.newreleases-status .LoadingIndicator .spinner-border'),
  ).toBeAttached({ timeout: 15_000 })
  expect(await queuedChecks()).toHaveLength(1)
  await expect(page.locator('.newreleases-status')).toContainText(/Checking/)
  // Watch the list while the check runs: a page that opened with nothing
  // takes every arrival into its list, in order, and has no Just in
  const seen = []
  while ((await queuedChecks()).length) {
    seen.push(await titles(page))
    await expect(page.locator('.newreleases-just-in')).toHaveCount(0)
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.newreleases-status')).toHaveText(
    /^Checked just now from (CandyDB and ThePornDB|ThePornDB and CandyDB)\.$/,
    { timeout: 15_000 },
  )
  await setPluginSettings(PLUGIN_ID, TEST_SETTINGS)
  // Stash lists favourites by name, so Gumball Gallery's came in first
  const gumball = new Set(fresh(TPDB_SITES.gumball))
  expect(
    seen.some((list) => list.length && list.every((t) => gumball.has(t))),
  ).toBe(true)
  for (const list of seen)
    expect(list).toEqual(
      newestFirst(SHOWN.filter((s) => list.includes(s.title))).map(
        (s) => s.title,
      ),
    )
  const order = newestFirst(SHOWN).map((s) => s.title)
  expect(await titles(page)).toEqual(order)
  await expect(page.locator('.paginationIndex')).toHaveText(
    `1-${SHOWN.length} of ${SHOWN.length}`,
  )
  // A studio's first check finds what is new to the catalog, not new
  // releases: nothing is New
  await expect(page.locator('.newreleases-new-badge')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.newreleases-card')).toHaveCount(SHOWN.length)
  expect(await titles(page)).toEqual(order)
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
      new RegExp(
        `^NewReleases/${VERSION.replaceAll('.', '\\.')} \\(Stash plugin; \\+https://github\\.com/CandyBoudoir/`,
      ),
    )
  }
  for (let i = 1; i < requests.length; i++)
    expect(requests[i].start - requests[i - 1].end).toBeGreaterThanOrEqual(1400)
})

test('Stash renders the elements the page builds on', async ({ page }) => {
  await openFilled(page)
  for (const selector of [
    '.top-nav .newreleases-nav .nav-menu-icon',
    '.filtered-list-toolbar',
    '.filtered-list-toolbar .sort-by-select .dropdown-toggle',
    '.react-select__control',
    '.page-size-selector select',
    '.pagination-index-container .paginationIndex',
    '.newreleases-card.grid-card.scene-card',
    '.newreleases-card .thumbnail-section',
    '.newreleases-card .scene-card-preview-image',
    '.newreleases-card .studio-overlay a',
    '.newreleases-card .scene-specs-overlay .overlay-duration',
    '.newreleases-card .card-section-title .TruncatedText',
    '.newreleases-card .scene-card__date',
    '.newreleases-card .TruncatedText.scene-card__description',
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

test('cards have a landscape cover, the date and the description', async ({
  page,
}) => {
  await openFilled(page)
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.scene-card-preview-image')].every(
      (i) => i.complete && i.naturalWidth,
    ),
  )
  const shapes = await page
    .locator('.newreleases-card .scene-card-preview-image')
    .evaluateAll((list) => list.map((i) => i.naturalWidth > i.naturalHeight))
  expect(shapes).toEqual(Array(SHOWN.length).fill(true))
  const lullaby = SHOWN.find((s) => s.title === 'Lollipop Lullaby')
  const c = card(page, 'Lollipop Lullaby')
  await expect(c.locator('.scene-card__date')).toHaveText(lullaby.date)
  await expect(c.locator('.scene-card__description')).toHaveText(
    lullaby.description,
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
    card(page, 'Sour Patch Party').locator('.newreleases-performer'),
  ).toHaveText(['Butterscotch Belle', 'Bonbon Bijou'])
  await expect(
    card(page, 'Lollipop Lullaby').locator('.newreleases-performer'),
  ).toHaveText(['Gumdrop Gigi', 'Peppermint Patti'])
  await expect(card(page, 'Lollipop Lullaby').locator('.tag-item')).toHaveText([
    'Candy',
    'Pastel',
    'Sprinkles',
  ])
})

test('releases you have never show, with no switch to show them', async ({
  page,
}) => {
  await openFilled(page)
  await expect(card(page, HELD_BY_ID.title)).toHaveCount(0)
  await expect(card(page, HELD_BY_URL.title)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /what I have/ })).toHaveCount(0)
  await expect(page.locator('.newreleases-card')).toHaveCount(SHOWN.length)
})

test('pages as Stash’s lists do, with its pagination and page sizes in the address', async ({
  page,
}) => {
  await openFilled(page, `${ROUTE}?perPage=3`)
  await expect(page.locator('.newreleases-card')).toHaveCount(3)
  await expect(page.locator('.paginationIndex')).toHaveText(
    `1-3 of ${SHOWN.length}`,
  )
  const top = page.locator('.pagination-index-container .pagination')
  await expect(top).toBeVisible()
  await expect(
    page.locator('.pagination-footer-container .pagination'),
  ).toBeVisible()
  const firstPage = await titles(page)
  await top.getByTitle('Next').click()
  await expect(page.locator('.paginationIndex')).toHaveText(
    `4-6 of ${SHOWN.length}`,
  )
  expect(new URL(page.url()).searchParams.get('p')).toBe('2')
  expect(await titles(page)).not.toEqual(firstPage)
  await page.reload()
  await expect(page.locator('.paginationIndex')).toHaveText(
    `4-6 of ${SHOWN.length}`,
  )
  // A page size from Stash's list starts again at the first page
  await page.locator('.page-size-selector select').selectOption('20')
  await expect(page.locator('.newreleases-card')).toHaveCount(SHOWN.length)
  expect(new URL(page.url()).search).toBe('?perPage=20')
  await expect(page.locator('.pagination-footer-container')).toHaveCount(0)
})

test('filters by studio, performer and tag, with and without, kept in the address', async ({
  page,
}) => {
  await openFilled(page, `${ROUTE}?studio=${studios['Lollipop Lounge']}`)
  const lollipop = fresh(TPDB_SITES.lollipop)
  await expect(page.locator('.newreleases-card')).toHaveCount(lollipop.length)
  await expect(page.locator('.studio-overlay')).toHaveText(
    Array(lollipop.length).fill('Lollipop Lounge'),
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
  await expect(page.locator('.newreleases-card')).toHaveCount(SHOWN.length)
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
  await expect(page.locator('.newreleases-card')).toHaveCount(SHOWN.length)
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

test('sorts as Stash’s lists do, with its sort menu and direction, kept in the address', async ({
  page,
}) => {
  await openFilled(page)
  const search = () => new URL(page.url()).search
  const select = page.locator('.filtered-list-toolbar .sort-by-select')
  const toggle = select.locator('.dropdown-toggle')
  const sortBy = async (label) => {
    await toggle.click()
    await page
      .locator('.sort-by-select .dropdown-item', { hasText: label })
      .click()
  }
  await expect(toggle).toHaveText('Date')
  await expect(select.getByRole('button', { name: 'Descending' })).toBeVisible()
  await toggle.click()
  await expect(page.locator('.sort-by-select .dropdown-item')).toHaveText(
    SORTS.map((s) => s.label),
  )
  await toggle.click()

  // As in Stash, a new sort keeps the direction: Title from Z
  const names = SHOWN.map((s) => s.title).sort(byName)
  await sortBy('Title')
  await expect.poll(search).toBe('?sortby=title&sortdir=desc')
  await expect(toggle).toHaveText('Title')
  expect(await titles(page)).toEqual([...names].reverse())
  await select.getByRole('button', { name: 'Descending' }).click()
  await expect.poll(search).toBe('?sortby=title&sortdir=asc')
  expect(await titles(page)).toEqual(names)
  await page.reload()
  await expect(page.locator('.newreleases-grid .newreleases-card')).toHaveCount(
    SHOWN.length,
  )
  expect(await titles(page)).toEqual(names)

  // Shortest first
  await sortBy('Duration')
  await expect.poll(search).toBe('?sortby=duration&sortdir=asc')
  expect(await titles(page)).toEqual(
    [...SHOWN].sort((a, b) => a.duration - b.duration).map((s) => s.title),
  )

  // Random keeps its seed in the address, and Reshuffle takes a new one
  await sortBy('Random')
  await expect.poll(search).toMatch(/^\?sortby=random_\d+&sortdir=asc$/)
  const seed = search()
  const shuffled = await titles(page)
  expect([...shuffled].sort(byName)).toEqual(names)
  await page.reload()
  await expect(page.locator('.newreleases-grid .newreleases-card')).toHaveCount(
    SHOWN.length,
  )
  expect(await titles(page)).toEqual(shuffled)
  await select.getByRole('button', { name: 'Reshuffle' }).click()
  await expect.poll(search).not.toBe(seed)
  await expect.poll(search).toMatch(/^\?sortby=random_\d+&sortdir=asc$/)

  // A filter and Clear filters keep the order
  await sortBy('Title')
  await card(page, 'Lollipop Lullaby')
    .getByRole('button', { name: 'Candy' })
    .click()
  await expect.poll(search).toMatch(/sortby=title&sortdir=asc/)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect.poll(search).toBe('?sortby=title&sortdir=asc')
  expect(await titles(page)).toEqual(names)
})

test('a check while the page is open puts what it finds in Just in, New, and the list holds still', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const late = lateRelease(TPDB_SITES.lollipop)
  await waitForChecks()
  // A day later, Lollipop Lounge has a new release
  await ageCatalog(21)
  await publishLate(TPDB_SITES.lollipop)
  try {
    await page.goto(ROUTE)
    await expect(page.locator('.newreleases-status')).toContainText(
      /Checking/,
      { timeout: 15_000 },
    )
    const order = newestFirst(SHOWN).map((s) => s.title)
    expect(await titles(page)).toEqual(order)
    const justIn = page.locator('.newreleases-just-in')
    await expect(justIn.locator('.recommendation-row-head h2')).toHaveText(
      'Just in',
      { timeout: 30_000 },
    )
    await waitForChecks()
    await expect(page.locator('.newreleases-status')).toHaveText(
      /^Checked just now/,
      { timeout: 15_000 },
    )
    expect(await justInTitles(page)).toEqual([late.title])
    await expect(
      justIn.locator(
        '.slick-slide:not(.slick-cloned) .newreleases-new-badge .badge',
      ),
    ).toHaveText('New')
    // The list never moved, and what the first check found is not New
    expect(await titles(page)).toEqual(order)
    await expect(
      page.locator('.newreleases-grid .newreleases-new-badge'),
    ).toHaveCount(0)
    await expect(page.locator('.paginationIndex')).toHaveText(
      `1-${SHOWN.length} of ${SHOWN.length}`,
    )
    // Filters reach Just in too: Caramel Coco is not in it
    await card(page, 'Gumball Galaxy')
      .getByRole('button', { name: 'Caramel Coco' })
      .click()
    await expect(justIn).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    expect(await justInTitles(page)).toEqual([late.title])

    // The next visit puts it in the list, still New, until the next check
    await page.goto(ROUTE)
    await expect(
      page.locator('.newreleases-grid .newreleases-card'),
    ).toHaveCount(SHOWN.length + 1)
    await expect(page.locator('.newreleases-just-in')).toHaveCount(0)
    expect(await titles(page)).toEqual(
      newestFirst([...SHOWN, late]).map((s) => s.title),
    )
    await expect(
      card(page, late.title).locator('.newreleases-new-badge'),
    ).toHaveText('New')
    await expect(
      page.locator('.newreleases-grid .newreleases-new-badge'),
    ).toHaveCount(1)
    // Found, newest first, puts it at the top
    await page.goto(`${ROUTE}?sortby=found&sortdir=desc`)
    await expect(card(page, late.title)).toBeVisible()
    expect((await titles(page))[0]).toBe(late.title)
  } finally {
    await withdrawLate()
  }
  expect(errors).toEqual([])
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
