// Juicy's test helpers, on top of the ones every plugin shares.
import { setPluginSettings, usePlugins } from '../../../tests/stash/helpers.mjs'

export * from '../../../tests/stash/helpers.mjs'

export const PLUGIN_ID = 'Theme-Juicy'

// Juicy alone: the other themes in the test Stash are switched off.
export const onlyJuicy = () => usePlugins(PLUGIN_ID)

export const setPlugin = (input) => setPluginSettings(PLUGIN_ID, input)

export const CHEEKY_EMPTY_LINE = 'Nothing juicy here. Yet.'
