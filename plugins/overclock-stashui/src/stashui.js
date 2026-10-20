// Overclock for Stash UI: Overclock's colours in Stash UI's ten colour slots,
// from Overclock's tokens (plugins/overclock/src/css/01-tokens.css), handed to
// the shared Stash UI style kit, which the build bundles into the
// assets/stashui.js Stash UI imports.
import { stashUIStyle } from '../../../shared/stashui/style.js'

export default stashUIStyle({
  pluginId: 'StashUI-Overclock',
  id: 'overclock',
  name: 'Overclock',
  colors: {
    '--pink': '#f3e600', // the accent: acid yellow
    '--bg': '#0a0a0c',
    '--bg-2': '#0d1416', // panel
    '--bg-3': '#24363b', // rule
    '--base': '#070b0c', // field: the menu, fields and lists
    '--text': '#e8efee',
    '--text-2': '#a8bab9', // muted
    '--faint': '#86999a', // dim
    '--ok': '#00e5ff', // cyan, Overclock's match colour
    '--danger': '#ff1f4b',
  },
})
