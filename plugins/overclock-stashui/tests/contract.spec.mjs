// Overclock for Stash UI's contract with Stash UI (tests/stash/stashui-style.mjs).
// citypop-stashui's spec runs the two side by side.
import { stashUIStyleSpecs } from '../../../tests/stash/stashui-style.mjs'

stashUIStyleSpecs({
  pluginId: 'StashUI-Overclock',
  id: 'overclock',
  name: 'Overclock',
  bg: '#0a0a0c',
  accent: '#f3e600',
  shine: '#00e5ff',
  title: 'Overclock Chakra',
  backdrop: 'rgba(0, 229, 255, 0.16)',
  scanline: true,
})
