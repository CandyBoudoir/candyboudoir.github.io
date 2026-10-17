// Ukiyo's test helpers, on top of the ones every plugin shares.
import { setPluginSettings, usePlugins } from '../../../tests/stash/helpers.mjs'

export * from '../../../tests/stash/helpers.mjs'

export const PLUGIN_ID = 'Theme-Ukiyo'

// Ukiyo alone: the other themes in the test Stash are switched off.
export const onlyUkiyo = () => usePlugins(PLUGIN_ID)

export const setPlugin = (input) => setPluginSettings(PLUGIN_ID, input)

export const VOICE_EMPTY_LINE = 'Come back a third time. Then, perhaps.'
