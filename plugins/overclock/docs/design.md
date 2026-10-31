# Overclock design

Overclock's look is the heads-up display of a hacker's control rig, running a session on the viewer: matte black, teal-black panels with a corner clipped at 45°, 1px frame lines with corner brackets and tick marks, hex readouts and hazard stripes, in acid yellow and data cyan. Ratings are charge chevrons, the favourite is a targeting reticle that locks on and the O counter is an overload bolt. The theme carries its edge in the motifs, a short glitch under the pointer and a cold system voice in the wording, with no explicit imagery.

The design-system page (`design-system/index.html`, built to `dist/site/overclock/index.html`) shows all of this applied to Stash's own markup.

## Palette

Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token                 | Hex       | Use                                           |
| --------------------- | --------- | --------------------------------------------- |
| `--overclock-yellow`  | `#F3E600` | Primary, active, ratings, the lock, focus     |
| `--overclock-cyan`    | `#00E5FF` | Readouts, info, links, the scan line, matches |
| `--overclock-red`     | `#FF1F4B` | Danger, misses, the glitch's left fringe      |
| `--overclock-magenta` | `#FF2FD0` | Glitch fringe only                            |
| `--overclock-orange`  | `#FF8A1F` | Tabs and charts in the restyled plugins       |
| `--overclock-green`   | `#4DFF6A` | Tabs and charts in the restyled plugins       |
| `--overclock-blue`    | `#4A8DFF` | Tabs, charts and O's in the restyled plugins  |
| `--overclock-violet`  | `#A66BFF` | Tabs and charts in the restyled plugins       |
| `--overclock-panel`   | `#0D1416` | Cards, panels, menus                          |
| `--overclock-raised`  | `#122024` | Raised panels                                 |
| `--overclock-line`    | `#3B5A60` | Frame lines, brackets, ticks                  |
| `--overclock-bg`      | `#0A0A0C` | Page, behind a dot grid                       |
| `--overclock-text`    | `#E8EFEE` | Text                                          |
| `--overclock-muted`   | `#A8BAB9` | Secondary text, 9.2:1 on panels               |
| `--overclock-dim`     | `#86999A` | Captions and labels, 6.2:1 on panels          |

Yellow marks what the system wants from the viewer. Cyan carries information. Red is kept for danger and misses, and yellow-and-black hazard stripes (`--overclock-hazard`) mark danger and locked states and nothing else. Orange, green, blue and violet appear only in the two plugins Overclock restyles (see Insights and Performers Toolkit).

## Type

Chakra Petch (SIL OFL 1.1) at 500 to 700 is the squared display face for the brand, section titles, card titles, buttons and the system's lines. Share Tech Mono (SIL OFL 1.1) carries every readout, label and number: hex IDs, durations, ratings, dates and the session clock. Both ship inside the plugin (`assets/fonts`) under Overclock's own family names (`Overclock Chakra`, `Overclock Mono`), because Stash's content security policy has no `font-src` and blocks font hosts. Body text, descriptions and settings stay on the system font.

## Screen

Two fixed layers sit behind the page, under every picture: a faint cyan dot grid on a 22px pitch with a cyan and a yellow haze at opposite corners, and a still scanline. Both are gradients with `pointer-events: none`, so they cost nothing while scrolling. The corner cut is `clip-path` driven by `--overclock-cut`, a registered property that does not inherit, so a child never takes its parent's cut.

## Motifs and glyphs

The motifs are flat technical line art in yellow and cyan on teal-black: a neural jack plug on its cable, a targeting reticle, an optical implant with an aperture iris, a microchip, a digital padlock with a hazard band, a wired controller and a countdown timer. They live with the design-system page (`design-system/ds/motifs`), which keeps the plugin small. The plugin ships the glyphs, the hex dump behind the loader and `flatline.svg`, a dead scope with a flat trace for empty lists.

Glyphs (`glyph-*.svg`) are flat silhouettes used as CSS masks, so one file takes any fill: `glyph-charge` and `glyph-charge-outline` for a rating and an empty rating, `glyph-reticle-open` and `glyph-reticle` for the favourite off and on, `glyph-bolt` for the O counter and `glyph-shard` for bursts.

## Components

- **Navigation** is a HUD strip, 58px tall, with a yellow rule and tick marks along its bottom edge. The brand is set in Chakra Petch beside a reticle, the active page sits in a yellow tab with a pip, and a session clock counts in a cyan readout where the bar has room (1440px and wider, and between 768px and 1199px when the links fold away).
- **Buttons** are flat panels with the bottom-right corner clipped. Primary is solid yellow with black type, secondary is a teal-black panel that turns yellow under the pointer, and the chosen item in a group goes cyan. Scan and Generate are outlined in cyan and yellow, Identify is solid cyan, and Delete is red behind a strip of hazard stripes. A disabled button is locked behind faint stripes. Stash's flat icon buttons (`.btn.minimal`) stay flat.
- **Cards** are chamfered panels with corner brackets round the picture. On hover the brackets close in, a cyan scan line crosses the picture once and a readout counts to 100%; the picture itself is never tinted. The rating is a yellow tag with a mono number and a five-segment meter, hung right of the card's checkbox and letting clicks through to it. A guessed rating, such as Cherry Pick's Your score, is the same tag left hollow: black with a yellow frame and yellow type (15:1), with no meter, opaque so it reads over any cover. Progress is a segmented bar and the divider a dashed rule with a tick at each end. Performer cards carry an ID readout.
- **Ratings** are five charge chevrons that fill left to right in yellow, with empty ones outlined. Outside cards the O counter is an overload gauge with an `OVL` label.
- **The zoom button on image cards** is a small clipped square in the picture's bottom-right corner, black on yellow. With a mouse it shows when the card is hovered or reached by keyboard; on touch screens it always shows.
- **Tags** are clipped mono chips with a cyan status light.
- **Forms** are dark fields with a bottom rule and corner ticks. Focus turns the frame yellow and starts a blinking block cursor. Checkboxes and switches are square.
- **Overlays** (menus, popovers, tooltips, toasts and modals) are clipped teal-black panels with a yellow left rule. A toast carries a `STASH` band and a message number, with a red variant for errors. A modal's header is a plain HUD bar, or a hazard band when its footer holds a danger button. A yellow icon goes before its title, and an icon on a button in it, such as Cherry Pick's speaker, takes the button's ink. A close button, which only Cherry Pick's dialogs have, ends the bar after the readout and sits on a black plate on the hazard band, and on a phone those dialogs drop the readout.
- **Loading** is a segmented bar that counts its percentage up over a scrolling hex dump. **Empty lists** show a dead scope with a flat cyan trace and the line No signal, in cyan, since an empty list is not an error.
- **Stash-box screens** (the Tagger, scrape dialogs, StashID links and Identify) are where people clear hundreds of rows, so nothing in them glitches, scans or moves, pseudo-elements and transitions included. The chosen result takes a yellow edge and the chosen select a yellow frame. Matches read cyan, warnings yellow and misses red, and StashID links are a cyan tag.

## Motion

Hovering a nav link, a button, a tab, a tag or a card title glitches it for 170ms: the glyphs turn transparent and their shadow, offset and split red and cyan, stands in for them, while a band inverts a slice of it. Nothing moves, resizes or clips the hovered element, so the pointer never falls off what it hovers. Rating, favouriting and bumping the O counter throw a burst of yellow and cyan pixels, data shards and hex digits. All animation stops when the viewer's system asks for reduced motion and when the Calm mode setting is on; the loader then holds a still frame at 64%.

## Copy

The system voice swaps a short list of Stash's own messages for short, cold lines (the list is `VOICE_COPY` in `src/js/overclock.js`). Matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", also gets "No signal. Nothing on this channel." The Plain labels setting turns all of it off and leaves the scope.

## SFW mode

Stash's SFW content mode keeps the display and drops the voice: the copy is off, bursts lose their red, and an empty list shows the scope with no line. Stash's own SFW icon for the O counter (a thumbs-up) is left alone.

## Insights and Performers Toolkit

Insights and Performers Toolkit are another author's plugins from one suite (gitlab.com/allisless0/stash-plugins). Insights is a stats dashboard on Stash's Stats page. Performers Toolkit has a page at `/performerstoolkit` (`.pt`), a strip under each performer's name (`#pt-strip`) and Stats and Catalog tabs on the performer's page (`.ptc`). Both paint themselves in the Flexoki palette through custom properties they set on their own roots (`--bg`, `--bg2`, `--ui` to `--ui3`, `--tx3` to `--hi`, eight accents from `--re` to `--ma`, and in Insights `--up`, `--down` and `--o`), from stylesheets they add after Overclock's. `82-insights.css` therefore starts its rules at `#root #insights` and `83-performers-toolkit.css` at `#root`, which outrank the plugins' own. Insights' tooltip (`#ins-tip`) and the toolkit's toast (`#pt-toast`) sit on `<body>`, so their rules start at their ids.

Each plugin has its own setting. With Restyle Insights on, `overclock.js` puts `.overclock-restyle-insights` on `<html>`, which every rule in `82-insights.css` waits for; with Restyle Performers Toolkit on, it puts `.overclock-restyle-toolkit` there for `83-performers-toolkit.css`. A plugin whose setting is on takes the display:

- **Their palette** becomes Overclock's: teal-black panels, black fields, Overclock's text tones and eight signals that stay apart on a panel. Overclock has four signals of its own and the two plugins colour up to eight things side by side, so `01-tokens.css` adds orange, green, blue and violet for them. Insights' tabs are You magenta, Actions red, Library orange, Files cyan, Metadata health yellow, Collection green and Movies violet, and the toolkit's are Find blue, Performers magenta, History violet and Sources green. Up and good read cyan and down and bad red, the Tagger's colours for a match and a miss. O's keep the suite's blue, which Insights' O heatmap draws in. The plugins' own rules keep painting from these properties, so their bars and rings follow.
- **Their slabs go**, and their cards sit on the dot grid like Stash's own pages. Cards are chamfered panels with a frame line, both cuts drawn and a cyan bracket in the bottom-left corner. The toolkit's dialog, its review bar and its toast also take an overlay's yellow left rule; the toast's rule turns cyan when something is done and red on an error.
- **Their heads** set the names in Chakra Petch caps over a frame line with ticks, and their tabs read as Stash's tabs, the open one yellow on a heavy underline.
- **Wells** are dark fields in a rule. Insights' chart wells add a form field's corner ticks, and the toolkit's search fields are Overclock's form fields. Chips are clipped mono tags, and the chosen chip of a row is a cyan readout. The step you are on in the toolkit's Find flow is yellow, and a card you pick in its review takes a yellow edge, as the chosen result does in the Tagger. A switch's label stays on the system font, as a setting's does.
- **Buttons** are Overclock's: a control panel that turns yellow under the pointer, solid yellow for the one that goes ahead, red behind hazard stripes for the one that deletes and a dashed frame over faint stripes when disabled. Ticked boxes and switches are square and yellow. Links are cyan and turn yellow under the pointer.
- **Numbers and small caps** are readouts in Share Tech Mono, as are Insights' Files tab, which already reads as a console, and the strip under a performer's name. Bars are segmented like Overclock's progress bars, and Insights' tooltip is a yellow tag like Stash's.

From Insights 2.12 and Performers Toolkit 0.13, each works out its own colours from the page: it reads the page's background and text and a hidden Bootstrap card and primary button, writes `--sx-*` tokens into its own `<style id="insights-sx">` or `<style id="performerstoolkit-sx">` and points the properties above at them. Insights keeps its in-between shades (row dividers, its error box, tinted verdicts and its calendars' steps) in `--ins-*` tokens. With the settings off, both already sit in Overclock's colours. Their newer rules, inline colours and SVG attributes use the `--sx-*` tokens directly, so with a setting on, `81-suite-tokens.css` points them, and Insights' `--ins-*` tokens, at the palette that setting gives the plugin: each hue reads as it is, its light and dark steps are mixed toward white and toward the page, and each calendar climbs from the panel to its hue (O's, watch time, hours) in five steps. Releases before those have no such tokens and ignore that file. Overclock never checks a plugin's version: each rule matches tokens or markup a release draws, and matches nothing on a release without them.

Up to 2.11, Insights writes some colours from its JavaScript as inline styles and SVG attributes. Its heatmaps, its codec and resolution colours, the colours of the toolkit plugins' cards and the segments of its splits keep Insights' tones. The empty heatmap cells, the charts' grey grid lines and labels, the growth line and the tag picked in Top tags are matched by their exact inline colour and moved to the display. Performers Toolkit writes its good, bad and link-hover colours, the ink on its filled tags, its toast's and review status's rules, its zoom slider and its scrollbars as hex in its own stylesheet, so Overclock overrides those rules by name. A release of either plugin that changes one of those values puts that one piece back in its own colour.

Both settings start off because the two plugins share Flexoki with their sibling plugins, which Overclock leaves alone, so someone who runs several of them keeps one look until they choose otherwise; turning both on keeps the two plugins alike. `overclock.js` keeps both in the browser (`localStorage`, `overclock.restyle`, as `{ insights, toolkit }`), so a page those plugins draw on never opens in Flexoki first. It reads the settings again on every page Stash opens, so changing one needs no reload.

Each setting's row in Settings > Plugins shows only while its plugin is on, since it has nothing to restyle otherwise. Stash puts a script tag for each enabled plugin in the page's head (`/plugin/Insights/…`, `/plugin/PerformersToolkit/…`) and gives a setting's switch the id `plugin-<plugin>-<setting>`, so one CSS rule per setting, in its plugin's file, hides the row while that script tag is missing. It needs no request and never flashes. The rule matches the id with an attribute selector, since stylelint's id pattern rejects the camelCase id.

Two rules besides the hiding apply with the settings off too. Insights' What works sidebar sticks under the navbar at Stash's height, so Overclock moves it below its own 58px bar; Performers Toolkit measures the navbar for its toast and its phone review bar, so it needs no such rule. The count on the toolkit's Catalog tab is a Stash badge that also carries `.pt-badge`, whose near-black type the toolkit sets for its own filled badges, so Overclock gives that count its own badge type, which reads on its dark badge.

The design-system page shows neither plugin.

## Settings

| Setting                    | Key                        | Effect                                             |
| -------------------------- | -------------------------- | -------------------------------------------------- |
| Calm mode                  | `calmMode`                 | Turns off Overclock's animations                   |
| Plain labels               | `plainCopy`                | Keeps Stash's own wording                          |
| Restyle Insights           | `restyleInsights`          | Puts Insights on Overclock's display too           |
| Restyle Performers Toolkit | `restylePerformersToolkit` | Puts Performers Toolkit on Overclock's display too |

All of them default to off, so a fresh install gets the full theme and leaves the two plugins as their author drew them. The two restyle settings show only while their plugins are on.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.LoadingIndicator` and `.sfw-content-mode`, plus the stash-box classes `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes. Stash changes its markup between releases, so each Stash release needs a pass over the design-system page and a live check.

Some couplings are specific to Overclock:

- The navbar is 58px (`--overclock-nav-height`) where Stash's is 48.75px. Stash spaces the page by its own height in several places, so `80-pages.css` moves the body padding, the filter sidebar, the sidebar toggle, the sticky detail header, the detail page's 98.75px offsets (the bar plus a 50px tab bar) and the task queue to match, and on an upright phone, where Stash docks the bar at the bottom, the bottom padding and the pagination footer. A Stash release that adds a rule using 48.75px needs the same.
- Bootstrap and Stash colour buttons per variant and state with high specificity, so each variant sets `--overclock-fill`, `--overclock-edge` and `--overclock-ink` and one base rule applies them with `!important`.
- The list toolbars' Sort by and more menus and a scene's Operations menu carry Bootstrap's `bg-secondary` and `text-white` on the menu and each item, which set their colours with `!important`, so Overclock's colours for them, hover and pressed states included, are `!important` too.
- Some Stash rules outrank a plain class (`div.dropdown-menu`, `div.react-select__control`, favourites, range sliders, the image zoom button), and modals render outside `#root`, so Overclock's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
- A toast's whole message sits in `.toast-header`, so the `STASH` band and message number are pseudo-elements.
- Stash fades its loader in with an animation, so Calm mode, which stops every animation, sets the loader visible itself.
- The Insights and Performers Toolkit rules target Insights 2.14.1 and Performers Toolkit 0.23.1: their custom properties, their `ins-*` and `pt-*` classes and a few of their inline and hex colours (see Insights and Performers Toolkit). The tests install those releases' files in every test Stash (`RESTYLED` in `tests/stash/companions.mjs`), and a contract test fails when a class Overclock styles for either stops rendering, against `tests/insights-unmatched-baseline.txt` and `tests/performerstoolkit-unmatched-baseline.txt`, the classes the demo library never shows (the toolkits' hub, duplicates and movies in Insights, and the toolkit's scan results, review screens and dialogs). The nightly run opens a "Restyle <plugin>" issue when a newer release is out.
