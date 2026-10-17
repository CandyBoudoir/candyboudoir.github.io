// Screentone's test helpers, on top of the ones every plugin shares.
import { setPluginSettings, usePlugins } from '../../../tests/stash/helpers.mjs'

export * from '../../../tests/stash/helpers.mjs'

export const PLUGIN_ID = 'Theme-Screentone'

// Screentone alone: the other themes in the test Stash are switched off.
export const onlyScreentone = () => usePlugins(PLUGIN_ID)

export const setPlugin = (input) => setPluginSettings(PLUGIN_ID, input)

export const EMPTY_LINE = 'Empty. Ask nicely next time.'
