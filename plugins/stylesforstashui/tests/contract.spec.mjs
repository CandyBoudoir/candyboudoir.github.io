// Styles for Stash UI's contract with Stash UI, another author's replacement
// interface. These run only on a Stash with Stash UI installed (plugin id
// stashui): the test Stash prepare.mjs builds has no Stash UI, so they skip
// there. To run them, install Stash UI into a throwaway Stash from its source
// (https://anonym88312.github.io/stash-pmv-plugins/index.yml) and point
// STASH_URL at it.
import { expect, test } from '@playwright/test'
import {
  gql,
  setPluginSettings,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'

const PLUGIN_ID = 'StylesForStashUI'
const APP = '/plugin/stashui/assets/index.html'
const LOOK = `${APP}#/settings/look`

const STYLES = [
  {
    id: 'citypop',
    name: 'City Pop',
    bg: '#0c0e30',
    accent: '#ff7a6b',
    shine: '#4fe3da',
    title: 'CityPop Dafoe',
  },
  {
    id: 'overclock',
    name: 'Overclock',
    bg: '#0a0a0c',
    accent: '#f3e600',
    shine: '#00e5ff',
    title: 'Overclock Chakra',
  },
]

const hasStashUI = async () =>
  (await gql('{ plugins { id } }')).plugins.some((p) => p.id === 'stashui')

const button = (page, style) =>
  page.locator(`.kb-theme-presets [data-preset="${PLUGIN_ID}:${style.id}"]`)
const colorsOnlySwitch = (page) => page.locator('.sfs-colors-only')
const rootVar = (page, name) =>
  page.evaluate(
    (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    name,
  )
const titleFont = (page) =>
  page
    .locator('.kb-h1')
    .first()
    .evaluate((h) => getComputedStyle(h).fontFamily)
const isOn = (locator) =>
  locator.evaluate((el) => el.classList.contains('is-on'))

async function openLook(page) {
  await page.goto(LOOK)
  await button(page, STYLES[1]).waitFor()
}

test.describe('beside Stash UI', () => {
  let errors = []

  test.beforeAll(async () => {
    test.skip(!(await hasStashUI()), 'Stash UI is not installed in this Stash')
    // Neither theme: the styles stand on their own
    await usePlugins(PLUGIN_ID, 'stashui')
    await setPluginSettings(PLUGIN_ID, {})
    // Stash UI copies a fresh browser's settings back from Stash, which
    // would carry one test's choice into the next
    await setPluginSettings('stashui', {})
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('stashui.autoBackup', 'false'),
    )
    errors = []
    page.on('pageerror', (error) => errors.push(error.message))
  })

  test.afterEach(async () => {
    expect(errors).toEqual([])
    await setPluginSettings(PLUGIN_ID, {})
  })

  test('the styles follow Stash UI’s own presets, none picked', async ({
    page,
  }) => {
    await openLook(page)
    const order = await page.$$eval('.kb-theme-presets [data-preset]', (els) =>
      els.map((el) => el.dataset.preset),
    )
    const own = order.filter((id) => !id.startsWith(`${PLUGIN_ID}:`))
    expect(order.slice(own.length)).toEqual(
      STYLES.map((style) => `${PLUGIN_ID}:${style.id}`),
    )
    for (const style of STYLES)
      expect(await isOn(button(page, style))).toBe(false)
    await expect(colorsOnlySwitch(page)).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.dataset.sfsStyle),
    ).toBeUndefined()
  })

  for (const style of STYLES) {
    test(`${style.name}: its colours and type, kept after a reload`, async ({
      page,
    }) => {
      await openLook(page)
      await button(page, style).click()
      expect(await isOn(button(page, style))).toBe(true)
      expect(await rootVar(page, '--bg')).toBe(style.bg)
      expect(await rootVar(page, '--pink')).toBe(style.accent)
      expect(await rootVar(page, '--shine')).toBe(style.shine)
      await expect(page.locator('[data-token="--bg"] code')).toHaveText(
        style.bg,
      )
      expect(await titleFont(page)).toContain(style.title)
      await expect(colorsOnlySwitch(page)).toBeVisible()
      await expect(colorsOnlySwitch(page).locator('input')).not.toBeChecked()

      // Stash UI paints the stored colours itself before the module loads
      await page.reload()
      await page.locator('#rail a').first().waitFor()
      expect(
        await page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--bg'),
        ),
      ).toBe(style.bg)
      await button(page, style).waitFor()
      expect(await isOn(button(page, style))).toBe(true)
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.dataset.sfsStyle),
        )
        .toBe(style.id)
    })
  }

  test('Colors only keeps Stash UI’s type and is saved in Stash', async ({
    page,
  }) => {
    await openLook(page)
    const before = await titleFont(page)
    await button(page, STYLES[0]).click()
    expect(await titleFont(page)).toContain(STYLES[0].title)

    await colorsOnlySwitch(page).locator('.kb-switch').click()
    await expect(colorsOnlySwitch(page).locator('input')).toBeChecked()
    expect(await titleFont(page)).toBe(before)
    expect(await rootVar(page, '--bg')).toBe(STYLES[0].bg)
    await expect
      .poll(async () => {
        const { configuration } = await gql(
          `{ configuration { plugins(include: ["${PLUGIN_ID}"]) } }`,
        )
        return configuration.plugins[PLUGIN_ID]?.colorsOnly
      })
      .toBe(true)

    // The switch follows the picked style's name
    await button(page, STYLES[1]).click()
    await expect(colorsOnlySwitch(page).locator('small')).toContainText(
      STYLES[1].name,
    )
    expect(await titleFont(page)).toBe(before)
  })

  test('Colors only set under Settings > Plugins applies on the next page', async ({
    page,
  }) => {
    await openLook(page)
    await button(page, STYLES[1]).click()
    expect(await titleFont(page)).toContain(STYLES[1].title)
    await setPluginSettings(PLUGIN_ID, { colorsOnly: true })
    await page.goto(`${APP}#/scenes`)
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.hasAttribute('data-sfs-type'),
        ),
      )
      .toBe(false)
  })

  test('another preset turns the style off', async ({ page }) => {
    await openLook(page)
    await button(page, STYLES[0]).click()
    await page.locator('.kb-theme-presets [data-preset="Ocean"]').click()
    await expect(button(page, STYLES[0])).toHaveCount(1)
    expect(await isOn(button(page, STYLES[0]))).toBe(false)
    await expect(colorsOnlySwitch(page)).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.dataset.sfsStyle),
    ).toBeUndefined()
    expect(await titleFont(page)).not.toContain(STYLES[0].title)
  })
  const layer = (page, pseudo, property) =>
    page.evaluate(
      ([pseudo, property]) => getComputedStyle(document.body, pseudo)[property],
      [pseudo, property],
    )

  test('each style’s backdrop, and the sun up only in Settings', async ({
    page,
  }) => {
    await openLook(page)
    await button(page, STYLES[0]).click()
    expect(await layer(page, '::before', 'backgroundImage')).toContain(
      'palms-backdrop.svg',
    )
    await expect.poll(() => layer(page, '::after', 'opacity')).toBe('0.5')
    await page.goto(`${APP}#/scenes`)
    await expect.poll(() => layer(page, '::after', 'opacity')).toBe('0')

    await openLook(page)
    await button(page, STYLES[1]).click()
    expect(await layer(page, '::before', 'backgroundImage')).toContain(
      'rgba(0, 229, 255, 0.16)',
    )
    expect(await layer(page, '::after', 'backgroundImage')).toContain(
      'repeating-linear-gradient',
    )

    // Colors only keeps Stash UI's halftone screen
    await colorsOnlySwitch(page).locator('.kb-switch').click()
    await expect
      .poll(() => layer(page, '::before', 'backgroundImage'))
      .not.toContain('rgba(0, 229, 255, 0.16)')
    expect(await layer(page, '::after', 'backgroundImage')).toBe('none')
  })

  test('Stash UI’s own background image takes the backdrop’s place', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stashui.wallpaper', 'true')
      localStorage.setItem('stashui.wallMode', '"fixed"')
      localStorage.setItem(
        'stashui.wallFixed',
        '"/plugin/StylesForStashUI/assets/icons/stars.svg"',
      )
    })
    await openLook(page)
    await button(page, STYLES[0]).click()
    await expect(page.locator('#kb-wall')).toBeAttached()
    expect(await layer(page, '::before', 'backgroundImage')).not.toContain(
      'palms-backdrop.svg',
    )
    expect(await titleFont(page)).toContain(STYLES[0].title)
  })
})
