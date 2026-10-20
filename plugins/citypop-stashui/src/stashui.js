// City Pop for Stash UI: City Pop's colours in Stash UI's ten colour slots,
// from City Pop's tokens (plugins/citypop/src/css/01-tokens.css), handed to
// the shared Stash UI style kit, which the build bundles into the
// assets/stashui.js Stash UI imports.
import { stashUIStyle } from '../../../shared/stashui/style.js'

export default stashUIStyle({
  pluginId: 'StashUI-CityPop',
  id: 'citypop',
  name: 'City Pop',
  colors: {
    '--pink': '#ff7a6b', // the accent: the sun
    '--bg': '#0c0e30', // night
    '--bg-2': '#1a1848', // panel
    '--bg-3': '#3a3678', // line
    '--base': '#0e0f33', // well: the menu, fields and lists
    '--text': '#fff4ec',
    '--text-2': '#cbc3ec', // muted
    '--faint': '#a39bd3', // dim
    '--ok': '#6ff0e6', // pool water
    '--danger': '#ff7d92',
  },
})
