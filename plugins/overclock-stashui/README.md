# Overclock for Stash UI

Overclock for Stash UI brings [Overclock](../overclock/README.md), a CandyBoudoir theme for Stash, to [Stash UI](https://github.com/anonym88312/stash-pmv-plugins), another author's replacement interface for Stash. Stash UI draws its own pages, so the classic theme never reaches it; this plugin adds Overclock as a style beside Stash UI's own colour presets. Overclock gives Stash UI its hacker's heads-up display: acid yellow on black, with cyan for focus. Page titles and the names on performer, studio and tag pages turn to yellow capitals with the red and cyan split a glitch leaves on type, section titles to capitals, tags and readouts to a monospace, and a reticle sits by the wordmark. Behind the page sits its faint cyan dot grid and haze under a static scanline. Turn on Colors only to keep Stash UI's own fonts, lettering and backdrop. Stash UI keeps its own layout, cards and motifs.

Overclock for Stash UI is incubating: it is built and tested here and not yet in the plugin source.

## What you need

- Stash UI, installed and on. Overclock for Stash UI does nothing without it, and Stash cannot install it for you, since it comes from another plugin source. Overclock for Stash UI is tested beside Stash UI 3.115.1.
- Not the Overclock theme: the style works beside any look in classic Stash.

## Pick Overclock

1. Open Stash UI, then Settings > Appearance.
2. Under Colors, click Overclock, after Stash UI's own presets.
3. To keep Stash UI's fonts, lettering and backdrop, turn on Colors only, which shows under the presets while Overclock is picked.

Stash UI keeps the choice in your browser, like its own presets, and paints Overclock's colours from the first frame on later visits. The type and backdrop follow a moment later, once Stash UI loads its extensions. Picking another preset, or Back to default colors, turns Overclock off. A colour changed with Stash UI's wheel keeps the rest of the style. Other CandyBoudoir styles for Stash UI work beside this one, each as its own preset.

## Settings

| Setting     | Effect                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors only | Off by default: Overclock brings its colours, its type and its backdrop. On: only its colours. The switch under Stash UI's presets and the one under Settings > Plugins are the same setting. |

## How it works

Stash UI imports `assets/stashui.js` from every enabled plugin, its way of letting plugins extend it. The module adds Overclock's button to Stash UI's colour presets and stores Overclock's colours in Stash UI's own colour setting, so Stash UI paints them itself. `stashui.css` adds a second accent and the focus ring and, unless Colors only is on, the fonts, the lettering of titles and the wordmark, and the backdrop in place of Stash UI's halftone screen. The backdrop steps aside when Stash UI's own background image is on, and sits under the glow liquid glass puts behind the page. The module reads Colors only from your Stash on each page Stash UI opens and makes no other requests. Its fonts, Chakra Petch and Share Tech Mono, ship inside the plugin, and your browser fetches them only while Overclock is picked with its type on.

With Overclock for Stash UI switched off, the button goes, and Stash UI keeps Overclock's colours until you pick another preset. Stash UI's Plugins page says the plugin adds nothing to Stash UI, since its extension API has no kind for colour presets and the button goes in without it.

## Made with AI

Overclock for Stash UI was built with Claude, Anthropic's AI coding assistant, which wrote the JavaScript and CSS under the author's direction. The author set the design and reviews the changes before each release. Commits that Claude helped write carry a `Co-Authored-By: Claude` line.

## Development

The repo's [README](../../README.md) covers building, testing and releasing. Overclock for Stash UI's files:

- `src/StashUI-Overclock.yml` is the plugin manifest.
- `src/stashui.js` holds Overclock's colours and hands them to the Stash UI style kit in `shared/stashui/style.js`, which every CandyBoudoir style for Stash UI shares. The build bundles the two into the module Stash UI imports.
- `src/css/` holds numbered partials that the build joins into one `stashui.css`: the fonts, the button's swatch and the style.
- `src/icons/` holds the reticle beside the wordmark.
- `tests/contract.spec.mjs` runs the shared contract in `tests/stash/stashui-style.mjs` beside the Stash UI release pinned in `tests/stash/companions.mjs` (EXTENDED).
- `plugin.mjs` tells the shared build what goes into the plugin folder.

## License

MIT, in the repo's [LICENSE](../../LICENSE). Chakra Petch and Share Tech Mono are bundled under the SIL Open Font License 1.1 (`assets/fonts/<font>/OFL.txt` in the plugin).
