// The plugin's names, in one place. PLUGIN_ID is the manifest id Stash keys
// everything by (config.yml, the plugin's settings, its route), and the
// custom-field, browser-storage and CSS prefixes derive from it, so changing
// it is a migration: stored configuration, custom fields and browser keys
// would all move.
export const PLUGIN_NAME = 'Cherry Pick'
export const PLUGIN_ID = 'CherryPick'

const slug = PLUGIN_ID.toLowerCase()
// PluginApi.register.route path for the plugin page
export const PLUGIN_ROUTE = '/plugin/' + slug
// custom fields the plugin writes on performers (tier 2)
export const FIELD_PREFIX = slug + '_'
// browser storage keys (tier 3)
export const STORAGE_PREFIX = slug + ':'
// "Cherry Pick's", for sentences
export const NAME_S = PLUGIN_NAME + (PLUGIN_NAME.endsWith('s') ? "'" : "'s")

// ClipRated is the later community-scores service; inside the plugin it only
// names the crowd score.
export const COMMUNITY_NAME = 'ClipRated'
