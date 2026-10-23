// Overclock's test helpers, on top of the ones every plugin shares.
import {
  setPluginSettings,
  switchPluginSetting,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'

export * from '../../../tests/stash/helpers.mjs'

export const PLUGIN_ID = 'Theme-Overclock'

// Overclock alone: the other themes in the test Stash are switched off.
export const onlyOverclock = () => usePlugins(PLUGIN_ID)

export const setPlugin = (input) => setPluginSettings(PLUGIN_ID, input)

// One switch of the theme's, turned in Settings › Plugins
export const switchSetting = (page, setting, on) =>
  switchPluginSetting(page, PLUGIN_ID, setting, on)

export const VOICE_EMPTY_LINE = 'No signal. Nothing on this channel.'
