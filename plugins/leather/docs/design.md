# Leather design

Leather's look is a harness: black pebble-grain leather, saddle stitching, nickel pyramid studs, buckles and O-rings, with a blood-red accent. Ratings are studs, the favourite is a studded collar and the O counter is a flogger. Titles are set in blackletter. The theme carries its edge in the gear, the stitching and a strict voice in the wording, with no explicit imagery.

The design-system page (`design-system/index.html`, built to `dist/site/leather/index.html`) shows all of this applied to Stash's own markup.

## Palette

Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token                  | Hex       | Use                                      |
| ---------------------- | --------- | ---------------------------------------- |
| `--leather-blood`      | `#B0182F` | Primary, active, chosen                  |
| `--leather-blood-hi`   | `#E0384F` | Red text, numbers, focus rings           |
| `--leather-oxblood`    | `#7A1424` | Pressed states, switches, the deeper dye |
| `--leather-nickel`     | `#C9C9CE` | Studs, rings, rivets, buckles            |
| `--leather-thread`     | `#B9AEA9` | Saddle stitching                         |
| `--leather-thread-red` | `#C42A3F` | Stitching on hover and focus             |
| `--leather-surface`    | `#151113` | Navbar, cards, panels, menus             |
| `--leather-raised`     | `#221B1E` | Secondary buttons, tabs, tooltips        |
| `--leather-bg`         | `#0C0A0B` | Page                                     |
| `--leather-text`       | `#ECE6E3` | Text                                     |
| `--leather-text-muted` | `#A99F9B` | Secondary text                           |
| `--leather-text-dim`   | `#948A8B` | Dates and captions, AA on leather        |

Black leather and nickel carry almost everything. Blood red marks what is chosen, active or hers, and oxblood is its pressed and deeper version. Status text keeps its meaning in muted tones: `--leather-success` `#8FD3A6`, `--leather-warning` `#E6AD69` and `--leather-danger` `#F0596C`. Four dyes serve only the charts and tabs of the plugins Leather restyles (see Insights and Performers Toolkit): `--leather-cognac` `#CC6F34`, `--leather-steel` `#8EA9C9`, `--leather-verdigris` `#6DB5AC` and `--leather-plum` `#A982BF`, with `--leather-well` `#0A0809` for the wells their charts sit in and `--leather-text-faint` `#6E6366` for their faintest labels.

## Type

Grenze Gotisch (SIL OFL 1.1), a blackletter drawn to stay readable, sets the brand, section, card and modal titles, toast messages and her lines, at weights 700 and 900. Oswald (SIL OFL 1.1) in letterspaced caps sets buttons, tags, tabs, labels and overlays. Both ship inside the plugin (`assets/fonts`) under Leather's own family names, because Stash's content security policy has no `font-src` and blocks font hosts. Body text, descriptions and settings stay on the system font.

## Materials

The leather is a seamless pebble-grain tile, and the grain is the same surface as light and shadow only, with alpha, laid over dyed leather (the blood, oxblood and black dyes are gradients). Both come from `tools/leather.py`, where every noise term is periodic on the tile and the normals wrap at the edges, so copies meet without a seam. Four rules keep it seamless:

- Tiles are lossless WebP. Lossy compression alters edge pixels and draws a faint line at every repeat.
- Each screen density gets its own file at the exact CSS size (384px leather, 192px grain) through `image-set()`, so a phone shows the grain at its own pixels instead of an upscaled 1x tile.
- A tile is always drawn at its native `background-size`. Resampling at the edges brings the seam back.
- Phones are checked with Playwright's WebKit and `devices['iPhone 13']`, not only a narrow Chromium window.

Studs, rivets and rings are CSS gradients (`--leather-stud-face`, `--leather-stud-diamond`, `--leather-ring-face`) or small SVGs: `studs.svg` is the stud strip, `stitch.svg` and `stitch-red.svg` are a nine-slice of slanted stitches drawn with `border-image`, and `strap.svg` and `strap-buckle.svg` are the belt under a modal title.

## Gear and glyphs

The gear is rendered as catalogue product shots in black leather, oxblood and nickel: the studded collar, the strap and roller buckle, the flogger, the O-ring junction of a harness and the studded paddle. They were rendered locally with Qwen-Image 2512 (Apache 2.0) and cut off their white background with `tools/cutout.py`, which keeps soft shadows as alpha so they sit on any leather. Only the collar ships in the plugin, at 256px for empty lists; the rest live with the design-system page, which keeps the plugin small.

Glyphs (`glyph-*.svg`) are flat silhouettes on a 24-unit grid, used as CSS masks so one file takes any fill: `glyph-stud` and `glyph-grommet` for a rating and an empty rating, `glyph-collar` for the favourite and `glyph-flogger` for the O counter.

## Components

- **Navigation** is a wide leather strap with a thread line along the top and a row of studs along the bottom. The active page is a blood-red patch stitched onto it. The brand is set in blackletter beside a stud.
- **Buttons** are dyed leather with an inner saddle stitch and a hard shadow. Primary is blood red with a nickel rivet at each end, secondary is black leather whose stitch turns red on hover, and success, warning, info and danger are bottle green, cognac, steel and bright red dyes. Pressing debosses the leather, and the chosen item of a group is pressed into oxblood. Stash's flat icon buttons (`.btn.minimal`) stay flat.
- **Cards** are stitched leather with the picture set in like a window. On hover they lift 3px and the thread turns red. Studs stay on the navbar: a strap or collar across the pictures crowded them, so the pictures run clear. The rating is a leather tab with a stud, hung to the right of the card's checkbox so it never covers it.
- **Ratings** are pyramid studs over punched grommets. On cards the rating is a blood-red leather tab hanging from the top of the picture, with a stud. It moves right, past the card's checkbox, on touch screens and on selected cards, where Stash shows the checkbox without hover.
- **The zoom button on image cards** is a 34px nickel dome in the picture's bottom-right corner. With a mouse it shows when the card is hovered or reached by keyboard; on touch screens it always shows.
- **Tags** are small leather tags with a nickel eyelet and a stitched edge.
- **Forms** are debossed into the leather, and focus runs a red stitch round the field. Switches are a leather strap with a nickel snap.
- **Overlays** (menus, popovers, tooltips, toasts and modals) are stitched leather. A modal carries a strap and roller buckle under its title. A toast sets its message in blackletter beside a stud, with a dyed edge for warnings and errors.
- **Loading** is three pyramid studs that light up in turn. **Empty lists** show the collar and a short order.
- **Stash-box screens** (the Tagger, scrape dialogs, StashID links and Identify) are where people clear hundreds of rows, so Tagger rows are flat, untextured leather that never lifts, and cards inside the Tagger keep still. The chosen result takes a blood-red edge and the chosen select a red ring and stitch. In a scrape dialog the winning side's toggle is dyed blood red and its field takes the red stitch. StashID links are a nickel tag with the ID on leather.

## Motion

Motion is short and firm (`--leather-ease`, 140 to 220ms). Rating, favouriting and bumping the O counter throw a burst of nickel studs, O-rings and red sparks. All animation stops when the viewer's system asks for reduced motion, and when the Calm mode setting is on; the loader's studs then stay lit at 70%.

## Copy

Strict copy swaps a short list of Stash's own messages for short orders in her voice (the list is `STRICT_COPY` in `src/js/leather.js`). Matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", also gets the collar and "Empty. Kneel and wait." The Plain labels setting turns all of it off and leaves the collar.

## SFW mode

Stash's SFW content mode keeps the leather and the studs and drops the collar and the voice: strict copy is off, bursts lose their sparks, the favourite is a stud that turns blood red, and an empty list shows an O-ring. Stash's own SFW icon for the O counter (a thumbs-up) is left alone.

## Insights and Performers Toolkit

[Insights](https://gitlab.com/allisless0/stash-plugins) (a stats dashboard on Stash's Stats page) and Performers Toolkit (a page at `/performerstoolkit`, a strip under a performer's name, Stats and Catalog tabs on the performer's page, a button on the Performers list and a toast) come from another author's suite of plugins. Each paints itself in the Flexoki palette through custom properties it sets on its own roots (`#insights`; `.pt`, `.ptc`, `.pt-strip`, `.pt-entry` and `#pt-toast`): `--bg`, `--bg2`, `--ui` to `--ui3`, `--tx3` to `--hi`, eight accents from `--re` to `--ma`, and in Insights `--up`, `--down` and `--o`. Each adds its stylesheet to the page after Leather's, so `82-insights.css` and `83-performers-toolkit.css` start their rules at `#root` (or at the id of a root that sits on `<body>`), which outranks theirs.

With the Restyle Insights and Performers Toolkit setting on, `leather.js` puts `.leather-restyle` on `<html>`, and both take the leather:

- **Their palette** becomes Leather's: surface leather for panels, `--leather-well` for wells and Leather's text tones. Their eight accents need colours that tell apart side by side, where a row of Insights tiles or its State chart shows five or more at once, so blood, nickel and the status tones are joined by the four data dyes. In Insights, You is nickel, Actions blood red, Library cognac, Files verdigris, Metadata health amber, Collection green and Movies plum; in Performers Toolkit, Find and Performers are steel, History plum and Sources green. Links and Insights' other blue charts are steel, and O's are thread, like the flogger. Insights grades from good to bad in green, amber, cognac and red, so You takes nickel and blood red keeps to Actions, deleting and state. Their own rules keep painting from these properties, so their charts and rings follow.
- **Their panels go**: the dashboard and the toolkit's page drop their dark slab, and their cards lie on the page as stitched leather like Stash's cards. An Insights tile's colour edge is dyed in without a glow, and a toolkit card's kind (a message, a run, an error) is dyed along its top edge.
- **The grain stays where it reads.** Cards keep the pebble grain behind their row bars and small charts. The wells that hold Insights' larger charts and heatmaps, and the toolkit's tiles, list cards and review wells, are flat and debossed, so pictures and numbers never sit on the texture.
- **Their heads** set the name in blackletter beside a stud, as in the navbar, and their tabs read as Stash's tabs: Oswald caps, the open one a raised leather flap with a red edge. Card and dialog titles are blackletter too. Numbers and small caps are in Oswald, which keeps every figure out of blackletter.
- **Fields, chips and switches** are debossed like Stash's fields, with the red stitch on focus, and the chosen chip or step of a row is pressed into oxblood with a stitch. A chosen card in a toolkit list takes the blood-red edge of the Tagger's chosen result. Buttons are dyed leather with an inner stitch: black, blood red with two rivets for the one that goes ahead, bright red for the one that deletes. Ticked boxes are blood red, switches are a leather strap with a nickel snap, links carry Stash's dashed red underline, and good and bad read in Leather's status green and red.
- **Overlays** are stitched leather. Insights' tooltip matches Stash's tooltips in Leather, in sentence case for its longer lines. The toolkit's dialogs sit over a darkened page with their stitch drawn as their own border, since they scroll, and its toast has its kind dyed along the left edge.

Insights writes some colours from its JavaScript as inline styles and SVG attributes. Its heatmaps, its codec and resolution colours, its grade ring, the colours of the toolkit plugins' cards and the segments of its splits keep Insights' tones. The empty heatmap cells, the charts' grey grid lines and labels, the growth line and the tag picked in Top tags (whose row carries its colour as `--c`) are matched by their exact inline colour and moved to the leather; an Insights release that changes one of those values puts that one piece back in its own colour. Performers Toolkit sets its colours in its stylesheet, so its fixed colours (good, bad, link hovers, the black type on its badges, the kinds of its toast and review bar) are moved by class.

The setting starts off because the two share their look with their sibling plugins (Movies Toolkit, Scenes Toolkit and others), which Leather leaves alone, so someone who runs several of them keeps one look until they choose otherwise. One setting covers both, so they never split. `leather.js` keeps it in the browser (`localStorage`, `leather.restylePlugins`), so a page they draw on never opens in Flexoki first, and reads the settings again on every page Stash opens, so changing it needs no reload.

Insights' What works sidebar sticks under the navbar at Stash's height, so Leather moves it below its own 64px bar whether the setting is on or off. The count on the toolkit's Catalog tab is a Stash badge, which Leather dresses as a black leather tag, and also carries the toolkit's badge class, whose near-black type would win; it keeps Leather's type either way too. Performers Toolkit measures Stash's navbar for its toast and its review bar on a phone, so it needs nothing. The design-system page shows neither plugin.

## Settings

| Setting                                 | Key              | Effect                                  |
| --------------------------------------- | ---------------- | --------------------------------------- |
| Calm mode                               | `calmMode`       | Turns off Leather's animations          |
| Plain labels                            | `plainCopy`      | Keeps Stash's own wording               |
| Restyle Insights and Performers Toolkit | `restylePlugins` | Puts those two plugins in black leather |

All three default to off, so a fresh install gets the full theme and leaves the two plugins as their author drew them.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.LoadingIndicator` and `.sfw-content-mode`, plus the stash-box classes `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes. Stash changes its markup between releases, so each Stash release needs a pass over the design-system page and a live check.

Some couplings are specific to Leather:

- The navbar is 64px (`--leather-nav-height`) where Stash's is 48.75px. Stash spaces the page by its own height in several places, so `80-pages.css` moves the body padding, the filter sidebar, the sidebar toggle, the sticky detail header and the task queue to match, and on an upright phone, where Stash docks the bar at the bottom, the bottom padding and the pagination footer. `82-insights.css` moves Insights' sticky sidebar the same way. A Stash release that adds a rule using 48.75px needs the same.
- Some menus and their items carry Bootstrap's `bg-secondary`, which sets their colour with `!important`, so the menu rules override it with `!important` too.
- Some Stash rules outrank a plain class (`div.dropdown-menu`, `div.react-select__control`, favourites, range sliders, the image zoom button), and modals render outside `#root`, so Leather's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
- A `url()` inside a custom property resolves against the stylesheet that uses it, so every rule that uses `--leather-tex`, `--leather-grain` or the stitch tokens lives in `leather.css`. The design-system page keeps its own copies of those tokens in `ds/ds.css`.
- The rules for the two plugins target Insights 2.11.0 and Performers Toolkit 0.4.2: their custom properties, their `ins-*` and `pt-*` classes and a few of Insights' inline colours (see Insights and Performers Toolkit). The tests install those releases' files in every test Stash (`RESTYLED` in `tests/stash/companions.mjs`), and a contract test per plugin fails when a class Leather styles stops rendering on its tour of the plugin, against `tests/insights-unmatched-baseline.txt` and `tests/performerstoolkit-unmatched-baseline.txt`, the classes the demo library never shows (Insights' toolkit hub, duplicates and movies; the toolkit's review screens, catalog cards and dialogs). The nightly run opens a "Restyle <plugin>" issue when a newer release of either is out.

## Tools

`tools/leather.py` writes the leather and grain tiles at 3x, 2x and 1x from one set of shading settings, as PNGs to convert with `cwebp -lossless -z 9 -exact -metadata none`. `tools/cutout.py` cuts a product render off a white background and resizes it to a square WebP. Both need Python 3 and Pillow.
