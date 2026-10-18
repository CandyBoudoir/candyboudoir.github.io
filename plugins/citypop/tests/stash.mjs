// City Pop's test helpers, on top of the ones every plugin shares.
import { setPluginSettings, usePlugins } from '../../../tests/stash/helpers.mjs'

export * from '../../../tests/stash/helpers.mjs'

export const PLUGIN_ID = 'Theme-CityPop'

// City Pop alone: the other themes in the test Stash are switched off.
export const onlyCityPop = () => usePlugins(PLUGIN_ID)

export const setPlugin = (input) => setPluginSettings(PLUGIN_ID, input)

export const VOICE_EMPTY_LINE = 'Nothing on this side. Not yet.'
