// Cherry Pick's entry point: Stash loads this bundle as a classic script after
// window.PluginApi exists, and everything the plugin adds hangs off the
// patches and the route registered here.
import { PLUGIN_ID } from './name.js'

const api = window.PluginApi
if (!api) {
  console.warn(`${PLUGIN_ID}: PluginApi is missing; Cherry Pick is off`)
}
