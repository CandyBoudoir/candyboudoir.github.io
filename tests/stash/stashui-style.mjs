// The contract every "<Theme> for Stash UI" plugin keeps with Stash UI,
// another author's replacement interface, for its plugin's spec to run with
// its own style (plugins/citypop-stashui/tests/contract.spec.mjs). prepare.mjs
// installs Stash UI (plugin id stashui) into every test Stash, switched off,
// from the commit EXTENDED.stashui in companions.mjs pins, and these switch it
// on beside the plugin alone, with neither theme.
//
// style: { pluginId, id, name, bg, accent, shine, title (a font family the
// type puts on page titles), backdrop (text in body::before's background
// with the type on), scanline (true when body::after holds one), sun (true
// when body::after holds a sun that rises only in Settings) }
import { expect, test } from '@playwright/test'
import { gql, setPluginSettings, usePlugins } from './helpers.mjs'

export const APP = '/plugin/stashui/assets/index.html'
export const LOOK = `${APP}#/settings/look`

export const styleButton = (page, style) =>
  page.locator(
    `.kb-theme-presets [data-preset="${style.pluginId}:${style.id}"]`,
  )
export const colorsOnlySwitch = (page, style) =>
  page.locator(`.cb-colors-only[data-plugin="${style.pluginId}"]`)
export const rootVar = (page, name) =>
  page.evaluate(
    (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    name,
  )
export const titleFont = (page) =>
  page
    .locator('.kb-h1')
    .first()
    .evaluate((h) => getComputedStyle(h).fontFamily)
export const isOn = (locator) =>
  locator.evaluate((el) => el.classList.contains('is-on'))
export const pickedStyle = (page) =>
  page.evaluate(() => document.documentElement.dataset.cbStyle)
const layer = (page, pseudo, property) =>
  page.evaluate(
    ([pseudo, property]) => getComputedStyle(document.body, pseudo)[property],
    [pseudo, property],
  )
const savedColorsOnly = async (style) => {
  const { configuration } = await gql(
    `{ configuration { plugins(include: ["${style.pluginId}"]) } }`,
  )
  return configuration.plugins[style.pluginId]?.colorsOnly
}

export async function openLook(page, style) {
  await page.goto(LOOK)
  await styleButton(page, style).waitFor()
}

// Each test starts in a fresh browser: Stash UI's auto-backup, which copies
// a fresh browser's settings back from Stash, stays off, so one test's
// choice never reaches the next, and a page error fails the test.
export function freshStashUIBrowser(plugins) {
  let errors = []
  test.beforeAll(async () => {
    await usePlugins(...plugins.map((style) => style.pluginId), 'stashui')
    for (const style of plugins) await setPluginSettings(style.pluginId, {})
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
    for (const style of plugins) await setPluginSettings(style.pluginId, {})
  })
}

export function stashUIStyleSpecs(style) {
  test.describe('beside Stash UI', () => {
    freshStashUIBrowser([style])

    test(`${style.name} follows Stash UI’s own presets, not picked`, async ({
      page,
    }) => {
      await openLook(page, style)
      const order = await page.$$eval(
        '.kb-theme-presets [data-preset]',
        (els) => els.map((el) => el.dataset.preset),
      )
      expect(order.at(-1)).toBe(`${style.pluginId}:${style.id}`)
      expect(await isOn(styleButton(page, style))).toBe(false)
      await expect(colorsOnlySwitch(page, style)).toHaveCount(0)
      expect(await pickedStyle(page)).toBeUndefined()
    })

    test('its colours and type, kept after a reload', async ({ page }) => {
      await openLook(page, style)
      await styleButton(page, style).click()
      expect(await isOn(styleButton(page, style))).toBe(true)
      expect(await rootVar(page, '--bg')).toBe(style.bg)
      expect(await rootVar(page, '--pink')).toBe(style.accent)
      expect(await rootVar(page, '--shine')).toBe(style.shine)
      await expect(page.locator('[data-token="--bg"] code')).toHaveText(
        style.bg,
      )
      expect(await titleFont(page)).toContain(style.title)
      await expect(colorsOnlySwitch(page, style)).toBeVisible()
      await expect(
        colorsOnlySwitch(page, style).locator('input'),
      ).not.toBeChecked()

      // Stash UI paints the stored colours itself before the module loads
      await page.reload()
      await page.locator('#rail a').first().waitFor()
      expect(
        await page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--bg'),
        ),
      ).toBe(style.bg)
      await styleButton(page, style).waitFor()
      expect(await isOn(styleButton(page, style))).toBe(true)
      await expect.poll(() => pickedStyle(page)).toBe(style.id)
    })

    test('Colors only keeps Stash UI’s type and is saved in Stash', async ({
      page,
    }) => {
      await openLook(page, style)
      const before = await titleFont(page)
      await styleButton(page, style).click()
      expect(await titleFont(page)).toContain(style.title)
      await colorsOnlySwitch(page, style).locator('.kb-switch').click()
      await expect(colorsOnlySwitch(page, style).locator('input')).toBeChecked()
      expect(await titleFont(page)).toBe(before)
      expect(await rootVar(page, '--bg')).toBe(style.bg)
      await expect.poll(() => savedColorsOnly(style)).toBe(true)
    })

    test('Colors only set under Settings > Plugins applies on the next page', async ({
      page,
    }) => {
      await openLook(page, style)
      await styleButton(page, style).click()
      expect(await titleFont(page)).toContain(style.title)
      await setPluginSettings(style.pluginId, { colorsOnly: true })
      await page.goto(`${APP}#/scenes`)
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.hasAttribute('data-cb-type'),
          ),
        )
        .toBe(false)
    })

    test('another preset turns the style off', async ({ page }) => {
      await openLook(page, style)
      await styleButton(page, style).click()
      await page.locator('.kb-theme-presets [data-preset="Ocean"]').click()
      await expect(styleButton(page, style)).toHaveCount(1)
      expect(await isOn(styleButton(page, style))).toBe(false)
      await expect(colorsOnlySwitch(page, style)).toHaveCount(0)
      expect(await pickedStyle(page)).toBeUndefined()
      expect(await titleFont(page)).not.toContain(style.title)
    })

    test('its backdrop in place of Stash UI’s halftone, off with Colors only', async ({
      page,
    }) => {
      await openLook(page, style)
      await styleButton(page, style).click()
      expect(await layer(page, '::before', 'backgroundImage')).toContain(
        style.backdrop,
      )
      if (style.scanline)
        expect(await layer(page, '::after', 'backgroundImage')).toContain(
          'repeating-linear-gradient',
        )
      if (style.sun) {
        await expect.poll(() => layer(page, '::after', 'opacity')).toBe('0.5')
        await page.goto(`${APP}#/scenes`)
        await expect.poll(() => layer(page, '::after', 'opacity')).toBe('0')
        await openLook(page, style)
      }
      await colorsOnlySwitch(page, style).locator('.kb-switch').click()
      await expect
        .poll(() => layer(page, '::before', 'backgroundImage'))
        .not.toContain(style.backdrop)
    })

    test('Stash UI’s own background image takes the backdrop’s place', async ({
      page,
    }) => {
      await page.addInitScript((pluginId) => {
        localStorage.setItem('stashui.wallpaper', 'true')
        localStorage.setItem('stashui.wallMode', '"fixed"')
        localStorage.setItem(
          'stashui.wallFixed',
          JSON.stringify(`/plugin/${pluginId}/assets/stashui.css`),
        )
      }, style.pluginId)
      await openLook(page, style)
      await styleButton(page, style).click()
      await expect(page.locator('#kb-wall')).toBeAttached()
      expect(await layer(page, '::before', 'backgroundImage')).not.toContain(
        style.backdrop,
      )
      expect(await titleFont(page)).toContain(style.title)
    })
  })
}
