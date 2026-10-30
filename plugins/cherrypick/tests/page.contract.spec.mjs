// Cherry Pick's page (features/pluginPage.jsx): its tabs, the For you tab
// (features/forYouPage.jsx) in Stash's own Grid, List and Wall, and the
// footer.
import { expect, test } from '@playwright/test'
import { companionPluginIds } from '../../../tests/stash/companions.mjs'
import {
  PLUGIN_ID,
  forYouCards,
  gql,
  pluginConfig,
  setUpCherryPick,
  tearDownCherryPick,
} from './stash.mjs'

let demo
test.beforeAll(async () => {
  ;({ demo } = await setUpCherryPick())
})
test.afterAll(tearDownCherryPick)

const list = (page) => page.locator('.cherrypick-fy-list')
const tabCards = (page) => list(page).locator('.scene-card')
const activeTab = (page) => page.locator('.cherrypick-tabs .nav-link.active')

// The scenes cards or table rows stand for, in order, by their links
const sceneIds = (items) =>
  items.evaluateAll((els) =>
    els.map(
      (el) =>
        el
          .querySelector('a[href^="/scenes/"]')
          ?.getAttribute('href')
          .match(/^\/scenes\/(\d+)/)?.[1],
    ),
  )
// A wall item has no link: its picture is the scene's preview or screenshot
const wallIds = (page) =>
  list(page)
    .locator('.wall-item')
    .evaluateAll((els) =>
      els.map(
        (el) =>
          el
            .querySelector('video, img')
            ?.getAttribute('src')
            .match(/\/scene\/(\d+)\//)?.[1],
      ),
    )
// "1-40 of 98": 98
const total = async (page) =>
  Number(
    (await page.locator('.cherrypick-fy-index').innerText())
      .match(/of ([\d,]+)/)[1]
      .replace(/,/g, ''),
  )

// The ids of scenes Stash finds with a filter, as a Set
async function scenesWhere(scene_filter) {
  const { findScenes } = await gql(
    'query ($f: SceneFilterType) { findScenes(scene_filter: $f, filter: { per_page: -1 }) { scenes { id } } }',
    { f: scene_filter },
  )
  return new Set(findScenes.scenes.map((s) => s.id))
}

async function press(target) {
  await expect(target).toBeVisible()
  await target.click({ force: companionPluginIds().includes('refract') })
}

test("View all opens the For you tab, the row's twelve first and then the rest", async ({
  page,
}) => {
  await page.goto('/')
  await expect(forYouCards(page)).toHaveCount(12, { timeout: 20_000 })
  const row = await sceneIds(forYouCards(page))
  await page
    .locator('.cherrypick-for-you')
    .getByRole('link', { name: 'View all' })
    .click()
  await expect(page).toHaveURL(/\/plugins\/cherrypick$/)
  await expect(activeTab(page)).toHaveText('For you')
  await expect(tabCards(page)).toHaveCount(40, { timeout: 20_000 })
  const tab = await sceneIds(tabCards(page))
  expect(tab.slice(0, 12)).toEqual(row)
  expect(new Set(tab).size).toBe(40)
  expect(await total(page)).toBeGreaterThan(40)
  // Every card says why it is there, as in the row
  await expect(list(page).locator('.cherrypick-reason').first()).not.toBeEmpty()
  // Back on the front page, the row still holds the same twelve
  await page.goBack()
  await expect(forYouCards(page)).toHaveCount(12, { timeout: 20_000 })
  expect(await sceneIds(forYouCards(page))).toEqual(row)
})

test("Grid, List and Wall are Stash's, in the address and kept for the next visit", async ({
  page,
}) => {
  await page.goto('/plugins/cherrypick')
  await expect(tabCards(page)).toHaveCount(40, { timeout: 20_000 })
  const grid = await sceneIds(tabCards(page))
  const modes = page.locator('.cherrypick-fy-modes')

  await modes.getByTitle('Wall').click()
  await expect(page).toHaveURL(/[?&]disp=2(&|$)/)
  await expect(list(page).locator('.wall-item')).toHaveCount(40)
  expect(await wallIds(page)).toEqual(grid)

  await modes.getByTitle('List').click()
  await expect(page).toHaveURL(/[?&]disp=1(&|$)/)
  const rows = list(page).locator('table tbody tr')
  await expect(rows).toHaveCount(40)
  expect(await sceneIds(rows)).toEqual(grid)

  await page.reload()
  await expect(rows).toHaveCount(40, { timeout: 20_000 })
  // an address without the view opens the last one used
  await page.goto('/plugins/cherrypick')
  await expect(rows).toHaveCount(40, { timeout: 20_000 })
  await expect(modes.getByTitle('List')).toHaveClass(/active/)
})

test("a card opens the player with For you's order as the queue, and Back comes back to the same page", async ({
  page,
}) => {
  await page.goto('/plugins/cherrypick?disp=0&per=20&p=2')
  await expect(tabCards(page)).toHaveCount(20, { timeout: 20_000 })
  const ids = await sceneIds(tabCards(page))
  await tabCards(page).nth(3).locator('a[href^="/scenes/"]').first().click()
  await expect(page).toHaveURL(new RegExp(`/scenes/${ids[3]}\\?`))
  expect(new URL(page.url()).searchParams.getAll('qs')).toEqual(ids)

  await page.goBack()
  await expect(page).toHaveURL(/\/plugins\/cherrypick\?.*\bp=2\b/)
  await expect(tabCards(page)).toHaveCount(20, { timeout: 20_000 })
  expect(await sceneIds(tabCards(page))).toEqual(ids)

  // a wall item, which Stash would open in its own scene list's order
  await page.locator('.cherrypick-fy-modes').getByTitle('Wall').click()
  await expect(list(page).locator('.wall-item')).toHaveCount(20)
  await list(page).locator('.wall-item').nth(1).click()
  await expect(page).toHaveURL(new RegExp(`/scenes/${ids[1]}\\?`))
  expect(new URL(page.url()).searchParams.getAll('qs')).toEqual(ids)
})

test('the filters narrow For you, live in the address and clear', async ({
  page,
}) => {
  const juno = demo.performers['Juno Marsh']
  const hers = await scenesWhere({
    performers: { value: [juno], modifier: 'INCLUDES' },
  })
  await page.goto(`/plugins/cherrypick?performers=${juno}`)
  await expect(tabCards(page).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.cherrypick-fy-filters')).toContainText(
    'Juno Marsh',
  )
  const ids = await sceneIds(tabCards(page))
  expect(ids.length).toBeGreaterThan(1)
  expect(ids.filter((id) => !hers.has(id))).toEqual([])
  const all = await total(page)
  expect(all).toBe(ids.length)

  await page.locator('.cherrypick-fy-clear').click()
  await expect(page).not.toHaveURL(/performers=/)
  await expect.poll(() => total(page)).toBeGreaterThan(40)

  // the search: every word in the title or a performer, studio or tag name
  await page.locator('.cherrypick-fy-search').fill('juno marsh')
  await expect(page).toHaveURL(/[?&]q=juno\+marsh/)
  await expect.poll(() => total(page)).toBe(all)
  expect(await sceneIds(tabCards(page))).toEqual(ids)

  await page.locator('.cherrypick-fy-clear').click()
  await page.locator('.cherrypick-fy-unwatched').click()
  await expect(page).toHaveURL(/[?&]unwatched=1/)
  const unplayed = await scenesWhere({
    play_count: { value: 0, modifier: 'EQUALS' },
  })
  await expect
    .poll(async () => {
      const shown = await sceneIds(tabCards(page))
      return shown.length > 0 && shown.every((id) => unplayed.has(id))
    })
    .toBe(true)
})

test('Not interested on a For you card takes it off the tab and is saved to Stash', async ({
  page,
}) => {
  await page.goto('/plugins/cherrypick')
  await expect(tabCards(page)).toHaveCount(40, { timeout: 20_000 })
  const [first] = await sceneIds(tabCards(page))
  await press(tabCards(page).first().locator('.cherrypick-card-menu button'))
  await press(page.locator('.cherrypick-ni').first())
  await expect
    .poll(async () => (await sceneIds(tabCards(page)))[0])
    .not.toBe(first)
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.notInterested || '[]'))
    .toHaveLength(1)

  // Manage › Not interested undoes it
  await page.locator('.cherrypick-tabs').getByText('Manage').click()
  await expect(page).toHaveURL(/\/plugins\/cherrypick\/manage$/)
  await page
    .locator('#not-interested')
    .getByRole('button', { name: 'Undo' })
    .click()
  await expect
    .poll(async () => JSON.parse((await pluginConfig())?.notInterested || '[]'))
    .toHaveLength(0)
})

test('each tab has its address, and old links to a section open its tab', async ({
  page,
}) => {
  await page.goto('/plugins/cherrypick/hall-of-fame')
  await expect(activeTab(page)).toHaveText('Hall of Fame')
  await expect(page.locator('#hall-of-fame')).toBeVisible()
  await page.locator('.cherrypick-tabs').getByText('Manage').click()
  await expect(page).toHaveURL(/\/plugins\/cherrypick\/manage$/)
  await expect(page.locator('#your-score')).toBeVisible()
  await page.goBack()
  await expect(activeTab(page)).toHaveText('Hall of Fame')

  await page.goto('/plugins/cherrypick#hall-of-fame')
  await expect(activeTab(page)).toHaveText('Hall of Fame')
  await page.goto('/plugins/cherrypick#dont-learn')
  await expect(activeTab(page)).toHaveText('Manage')
  await expect(page.locator('#dont-learn')).toBeInViewport()
})

test('the footer has the version Stash installed, the links and Ko-fi', async ({
  page,
}) => {
  const { plugins } = await gql('{ plugins { id version } }')
  const { version } = plugins.find((p) => p.id === PLUGIN_ID)
  await page.goto('/plugins/cherrypick/manage')
  const footer = page.locator('.cherrypick-footer')
  await expect(footer).toContainText(`Cherry Pick ${version}`, {
    timeout: 20_000,
  })
  await expect(
    footer.getByRole('link', { name: 'Support Cherry Pick' }),
  ).toHaveAttribute('href', 'https://ko-fi.com/candyboudoir')
  await expect(footer.getByRole('link', { name: 'Forum' })).toHaveAttribute(
    'href',
    'https://discourse.stashapp.cc/t/cherry-pick/18889',
  )
})

test('on a phone the filters fold behind a button and nothing runs off the side', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/plugins/cherrypick')
  await expect(tabCards(page).first()).toBeVisible({ timeout: 20_000 })
  const unwatched = page.locator('.cherrypick-fy-unwatched')
  await expect(unwatched).toBeHidden()
  await page.locator('.cherrypick-fy-more-toggle').click()
  await expect(unwatched).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0)
})
