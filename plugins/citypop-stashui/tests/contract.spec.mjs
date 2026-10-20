// City Pop for Stash UI's contract with Stash UI (tests/stash/stashui-style.mjs),
// and with Overclock for Stash UI beside it.
import { expect, test } from '@playwright/test'
import {
  colorsOnlySwitch,
  freshStashUIBrowser,
  isOn,
  openLook,
  pickedStyle,
  rootVar,
  savedColorsOnly,
  stashUIStyleSpecs,
  styleButton,
  titleFont,
} from '../../../tests/stash/stashui-style.mjs'

const CITY_POP = {
  pluginId: 'StashUI-CityPop',
  id: 'citypop',
  name: 'City Pop',
  bg: '#0c0e30',
  accent: '#ff7a6b',
  shine: '#4fe3da',
  title: 'CityPop Dafoe',
  backdrop: 'palms-backdrop.svg',
  sun: true,
}

const OVERCLOCK = {
  pluginId: 'StashUI-Overclock',
  id: 'overclock',
  name: 'Overclock',
  bg: '#0a0a0c',
  accent: '#f3e600',
  title: 'Overclock Chakra',
}

stashUIStyleSpecs(CITY_POP)

// Each plugin touches the page only while its own style is picked, so the
// two run side by side
test.describe('beside Overclock for Stash UI', () => {
  freshStashUIBrowser([CITY_POP, OVERCLOCK])

  test('both styles follow Stash UI’s presets, each with its own switch', async ({
    page,
  }) => {
    await openLook(page, CITY_POP)
    await styleButton(page, OVERCLOCK).waitFor()

    await styleButton(page, CITY_POP).click()
    expect(await pickedStyle(page)).toBe('citypop')
    await expect(colorsOnlySwitch(page, CITY_POP)).toBeVisible()
    await expect(colorsOnlySwitch(page, OVERCLOCK)).toHaveCount(0)

    await styleButton(page, OVERCLOCK).click()
    expect(await pickedStyle(page)).toBe('overclock')
    expect(await rootVar(page, '--bg')).toBe(OVERCLOCK.bg)
    expect(await isOn(styleButton(page, CITY_POP))).toBe(false)
    expect(await isOn(styleButton(page, OVERCLOCK))).toBe(true)
    await expect(colorsOnlySwitch(page, OVERCLOCK)).toBeVisible()
    await expect(colorsOnlySwitch(page, CITY_POP)).toHaveCount(0)
    expect(await titleFont(page)).toContain(OVERCLOCK.title)

    // City Pop's Colors only leaves Overclock's type alone
    await styleButton(page, CITY_POP).click()
    await colorsOnlySwitch(page, CITY_POP).locator('.kb-switch').click()
    await expect.poll(() => savedColorsOnly(CITY_POP)).toBe(true)
    await styleButton(page, OVERCLOCK).click()
    expect(await titleFont(page)).toContain(OVERCLOCK.title)
  })
})
