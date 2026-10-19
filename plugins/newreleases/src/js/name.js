// The plugin's names, in one place. PLUGIN_ID is the manifest id Stash keys
// the plugin by (its settings, its assets' address), and the task's name is
// how the page finds the check in Stash's job queue.
export const PLUGIN_NAME = 'New Releases'
export const PLUGIN_ID = 'NewReleases'
export const TASK_NAME = 'Check for new releases'

// Stash's server owns /plugin/ (plugin assets), so a reload there would 404;
// /plugins/ is free.
export const PLUGIN_ROUTE = '/plugins/newreleases'
// Where the task keeps the catalog, served from the plugin's folder.
export const CATALOG_URL = `/plugin/${PLUGIN_ID}/assets/catalog/catalog.json`
