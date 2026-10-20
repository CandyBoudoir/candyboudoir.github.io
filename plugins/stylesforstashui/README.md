# Styles for Stash UI

Styles for Stash UI brings two CandyBoudoir themes, [City Pop](../citypop/README.md) and [Overclock](../overclock/README.md), to [Stash UI](https://github.com/anonym88312/stash-pmv-plugins), another author's replacement interface for Stash. Stash UI draws its own pages, so the classic themes never reach it; this plugin adds each theme as a style beside Stash UI's own colour presets. A style gives Stash UI the theme's colours, type and backdrop. City Pop brings night blue and sunset coral, page and section titles in its brush script, a chrome wordmark, and its dusk of stars and palms behind the page. Overclock brings acid yellow on black, yellow capitals that carry a glitch split, a reticle by the wordmark, and its dot grid and scanline behind the page. Turn on Colors only to keep Stash UI's own fonts, lettering and backdrop. Stash UI keeps its own layout, cards and motifs.

Styles for Stash UI is incubating: it is built and tested here and not yet in the plugin source.

## What you need

- Stash UI, installed and on. Styles for Stash UI does nothing without it, and Stash cannot install it for you, since it comes from another plugin source.
- Neither theme: the styles work beside any look in classic Stash.

## Pick a style

1. Open Stash UI, then Settings > Appearance.
2. Under Colors, click City Pop or Overclock, after Stash UI's own presets.
3. To keep Stash UI's fonts, lettering and backdrop, turn on Colors only, which shows under the presets while a style is picked.

Stash UI keeps the choice in your browser, like its own presets, and paints the style's colours from the first frame on later visits. The type follows a moment later, once Stash UI loads its extensions. Picking another preset, or Back to default colors, turns the style off. A colour changed with Stash UI's wheel keeps the rest of the style.

## Settings

| Setting     | Effect                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors only | Off by default: a style brings its colours, its type and its backdrop. On: only its colours. The switch under Stash UI's presets and the one under Settings > Plugins are the same setting. |

## How it works

Stash UI imports `assets/stashui.js` from every enabled plugin, its way of letting plugins extend it. The module adds a button per style to Stash UI's colour presets and stores the picked style's colours in Stash UI's own colour setting, so Stash UI paints them itself. `stashui.css` adds a second accent and the focus ring and, unless Colors only is on, the fonts, the lettering of titles and the wordmark, and the backdrop in place of Stash UI's halftone screen. City Pop's sun rises only in Settings, as in classic City Pop, since every other Stash UI page has a grid, a header or the player across the horizon. Either backdrop steps aside when Stash UI's own background image is on, and sits under the glow liquid glass puts behind the page. It reads Colors only from your Stash on each page Stash UI opens and makes no other requests. Its fonts, Jost, Mr Dafoe, Chakra Petch and Share Tech Mono, ship inside the plugin, and your browser fetches only those of the style you pick.

With Styles for Stash UI switched off, the buttons go, and Stash UI keeps the last style's colours until you pick another preset.

## Made with AI

Styles for Stash UI was built with Claude, Anthropic's AI coding assistant, which wrote the JavaScript and CSS under the author's direction. The author set the design and reviews the changes before each release. Commits that Claude helped write carry a `Co-Authored-By: Claude` line.

## Development

The repo's [README](../../README.md) covers building, testing and releasing. Styles for Stash UI's files:

- `src/StylesForStashUI.yml` is the plugin manifest.
- `src/stashui.js` is the module Stash UI imports: the styles' colours, their buttons, the Colors only switch and the attributes the stylesheet waits for.
- `src/css/` holds numbered partials that the build joins into one `stashui.css`: the fonts, the buttons' swatches and one partial per style.
- `src/icons/` holds City Pop's sun, its backdrop's palms, stars and setting sun, and Overclock's reticle.
- `tests/` holds the compatibility checks, which run only on a Stash with Stash UI installed.
- `plugin.mjs` tells the shared build what goes into the plugin folder.

## License

MIT, in the repo's [LICENSE](../../LICENSE). Jost, Mr Dafoe, Chakra Petch and Share Tech Mono are bundled under the SIL Open Font License 1.1 (`assets/fonts/<font>/OFL.txt` in the plugin).
