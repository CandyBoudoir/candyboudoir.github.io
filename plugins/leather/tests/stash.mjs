// Leather's test helpers, on top of the ones every plugin shares.
import {
  setPluginSettings,
  switchPluginSetting,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'

export * from '../../../tests/stash/helpers.mjs'

export const PLUGIN_ID = 'Theme-Leather'

// Leather alone: the other themes in the test Stash are switched off.
export const onlyLeather = () => usePlugins(PLUGIN_ID)

export const setPlugin = (input) => setPluginSettings(PLUGIN_ID, input)

// One switch of the theme's, turned in Settings › Plugins
export const switchSetting = (page, setting, on) =>
  switchPluginSetting(page, PLUGIN_ID, setting, on)

export const STRICT_EMPTY_LINE = 'Empty. Kneel and wait.'
