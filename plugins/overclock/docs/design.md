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
| `--overclock-panel`   | `#0D1416` | Cards, panels, menus                          |
| `--overclock-raised`  | `#122024` | Raised panels                                 |
| `--overclock-line`    | `#3B5A60` | Frame lines, brackets, ticks                  |
| `--overclock-bg`      | `#0A0A0C` | Page, behind a dot grid                       |
| `--overclock-text`    | `#E8EFEE` | Text                                          |
| `--overclock-muted`   | `#A8BAB9` | Secondary text, 9.2:1 on panels               |
| `--overclock-dim`     | `#86999A` | Captions and labels, 6.2:1 on panels          |

Yellow marks what the system wants from the viewer. Cyan carries information. Red is kept for danger and misses, and yellow-and-black hazard stripes (`--overclock-hazard`) mark danger and locked states and nothing else.

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
- **Cards** are chamfered panels with corner brackets round the picture. On hover the brackets close in, a cyan scan line crosses the picture once and a readout counts to 100%; the picture itself is never tinted. The rating is a yellow tag with a mono number and a five-segment meter, hung right of the card's checkbox and letting clicks through to it. Progress is a segmented bar and the divider a dashed rule with a tick at each end. Performer cards carry an ID readout.
- **Ratings** are five charge chevrons that fill left to right in yellow, with empty ones outlined. Outside cards the O counter is an overload gauge with an `OVL` label.
- **The zoom button on image cards** is a small clipped square in the picture's bottom-right corner, black on yellow. With a mouse it shows when the card is hovered or reached by keyboard; on touch screens it always shows.
- **Tags** are clipped mono chips with a cyan status light.
- **Forms** are dark fields with a bottom rule and corner ticks. Focus turns the frame yellow and starts a blinking block cursor. Checkboxes and switches are square.
- **Overlays** (menus, popovers, tooltips, toasts and modals) are clipped teal-black panels with a yellow left rule. A toast carries a `STASH` band and a message number, with a red variant for errors. A modal's header is a plain HUD bar, or a hazard band when its footer holds a danger button.
- **Loading** is a segmented bar that counts its percentage up over a scrolling hex dump. **Empty lists** show a dead scope with a flat cyan trace and the line No signal, in cyan, since an empty list is not an error.
- **Stash-box screens** (the Tagger, scrape dialogs, StashID links and Identify) are where people clear hundreds of rows, so nothing in them glitches, scans or moves, pseudo-elements and transitions included. The chosen result takes a yellow edge and the chosen select a yellow frame. Matches read cyan, warnings yellow and misses red, and StashID links are a cyan tag.

## Motion

Hovering a nav link, a button, a tab, a tag or a card title glitches it for 170ms: the glyphs turn transparent and their shadow, offset and split red and cyan, stands in for them, while a band inverts a slice of it. Nothing moves, resizes or clips the hovered element, so the pointer never falls off what it hovers. Rating, favouriting and bumping the O counter throw a burst of yellow and cyan pixels, data shards and hex digits. All animation stops when the viewer's system asks for reduced motion and when the Calm mode setting is on; the loader then holds a still frame at 64%.

## Copy

The system voice swaps a short list of Stash's own messages for short, cold lines (the list is `VOICE_COPY` in `src/js/overclock.js`). Matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", also gets "No signal. Nothing on this channel." The Plain labels setting turns all of it off and leaves the scope.

## SFW mode

Stash's SFW content mode keeps the display and drops the voice: the copy is off, bursts lose their red, and an empty list shows the scope with no line. Stash's own SFW icon for the O counter (a thumbs-up) is left alone.

## Settings

| Setting      | Key         | Effect                           |
| ------------ | ----------- | -------------------------------- |
| Calm mode    | `calmMode`  | Turns off Overclock's animations |
| Plain labels | `plainCopy` | Keeps Stash's own wording        |

Both default to off, so a fresh install gets the full theme.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.LoadingIndicator` and `.sfw-content-mode`, plus the stash-box classes `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes. Stash changes its markup between releases, so each Stash release needs a pass over the design-system page and a live check.

Some couplings are specific to Overclock:

- The navbar is 58px (`--overclock-nav-height`) where Stash's is 48.75px. Stash spaces the page by its own height in several places, so `80-pages.css` moves the body padding, the filter sidebar, the sidebar toggle, the sticky detail header, the detail page's 98.75px offsets (the bar plus a 50px tab bar) and the task queue to match, and on an upright phone, where Stash docks the bar at the bottom, the bottom padding and the pagination footer. A Stash release that adds a rule using 48.75px needs the same.
- Bootstrap and Stash colour buttons per variant and state with high specificity, so each variant sets `--overclock-fill`, `--overclock-edge` and `--overclock-ink` and one base rule applies them with `!important`.
- Some menus and their items carry Bootstrap's `bg-secondary`, which sets their colour with `!important`, so the menu rules override it with `!important` too.
- Some Stash rules outrank a plain class (`div.dropdown-menu`, `div.react-select__control`, favourites, range sliders, the image zoom button), and modals render outside `#root`, so Overclock's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
- A toast's whole message sits in `.toast-header`, so the `STASH` band and message number are pseudo-elements.
- Stash fades its loader in with an animation, so Calm mode, which stops every animation, sets the loader visible itself.
