# Juicy design

Juicy's look is Candy Boudoir: the colours and gloss of a candy shop, with a little boudoir cheek in the wording, the motion and the small details. Naughtiness lives in words, motion and motifs (cherries, lips, drips, hearts) and never in explicit imagery. Two sticker illustrations, a bubblegum-blowing pink head in a lime crown and a heart padlock with a gold key, set the style. They belong to the author's own collection and do not ship; every Juicy icon is drawn from scratch in SVG.

The design-system page (`design-system/index.html`, built to `dist/site/juicy/index.html`) shows all of this applied to Stash's own markup.

## Palette

Sampled from the sticker references. Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token                 | Hex       | Use                                           |
| --------------------- | --------- | --------------------------------------------- |
| `--juicy-pink`        | `#FC3D9F` | Primary buttons, active nav, the brand        |
| `--juicy-bubblegum`   | `#FC68B2` | Hover states, highlights, the loader          |
| `--juicy-magenta`     | `#DD2A97` | Pressed states, gradient shadows              |
| `--juicy-lime`        | `#D7FA54` | Card hover halo, focus rings, selection       |
| `--juicy-gold`        | `#FDDA4E` | Rating hearts and rating badges               |
| `--juicy-cyan`        | `#00A8F0` | Links, info                                   |
| `--juicy-purple`      | `#9B30FF` | Tags and secondary chips                      |
| `--juicy-danger`      | `#FF5A4E` | Destructive actions, kept clear of the pinks  |
| `--juicy-ink`         | `#010224` | Outlines, hard drop shadows, text on candy    |
| `--juicy-bg`          | `#150A2E` | Page background, with pink polka dots         |
| `--juicy-card`        | `#22123F` | Cards, panels, sidebars                       |
| `--juicy-card-raised` | `#2D1852` | Menus, secondary buttons, toasts              |
| `--juicy-tangerine`   | `#FE9A4E` | Between gold and danger, for restyled plugins |
| `--juicy-blueberry`   | `#6B86FF` | Between cyan and purple, for restyled plugins |

Text on candy fills (pink, lime, gold, cyan, danger) is ink, which keeps contrast at 6:1 or better. Text on plum is `--juicy-text` (`#FFF2FA`), with `--juicy-text-muted`, `--juicy-text-dim` and `--juicy-text-faint` for quieter lines.

Tangerine and blueberry are the two colours the plugins Juicy restyles need beyond the stickers' eight (see Insights and Performers Toolkit). Each sits between two palette colours, and blueberry is lighter than their midpoint so its text reads on plum at 5:1.

## Type

Fredoka (SIL OFL 1.1) sets headings, card titles, buttons, chips and badges. It ships inside the plugin (`assets/fonts`) because Stash's content security policy has no `font-src` and blocks font hosts. Body text, descriptions and settings stay on the system font.

## Stickers and glyphs

Stickers are the decorative icons: `mascot`, `cherry`, `heart`, `lips`, `heart-lock`, `crown`, `bubble`, `drip`, `sparkle`, `bolt`. Each is drawn on a 64-unit grid inside a `-4 -4 72 74` viewBox and built from the same four layers, back to front:

1. A soft ink drop: the shape stroked 10 wide in ink at 45% opacity, offset 3 down.
2. The lime cut edge: the shape stroked 10 wide in lime (the bolt uses pink, so it reads against its own lime body).
3. The body: a glossy radial or linear gradient with a 3.5 ink outline.
4. The relief and shine: clipped violet shadows on pink candy, facets on gold and lime, and curved cream reflections that follow each shape. Smaller rim reflections keep the volume readable on dark backgrounds.

The mascot is a cherry girl with a purple bow on one side of her head, big glossy eyes with lashes, an open smile and blush. Her leaf grows from the side of the stem, tucked behind it. Her face is built from solid shapes with no fine lines, so it stays readable at 24px; the lashes and the shine on the bow show from about 48px. Decorative stickers remain transparent vectors with local references only. Keep the mask glyphs flat so their silhouettes stay clear at control sizes.

Glyphs (`glyph-*.svg`) are flat silhouettes on a 24-unit grid. The theme uses them as CSS masks over `currentcolor`, so one file serves every colour: hearts replace the rating stars, the drip replaces the O counter's drops.

## Components

- **Buttons** are glossy pills with an ink outline on a hard 3px ink drop. They lift 2px on hover and squish on press. Stash renders its icon buttons as `.btn.btn-primary.minimal`; those stay flat and take a pink wash on hover.
- **Cards** are stickers: ink outline, 20px corners and a 5px ink drop. On hover they lift, tilt half a degree, take a lime halo, and a shine sweeps across the thumbnail.
- **The zoom button on image cards** opens the lightbox. It is a 36px candy sticker in the picture's bottom-right corner, away from the rating ribbon and checkbox. With a mouse it pops in when the card is hovered or reached by keyboard; on touch screens it always shows, with a 44px tap area.
- **Ratings** are gold hearts. The Font Awesome star paths are hidden and the svg paints a heart through a mask. On cards the rating is a tilted gold pill in the top-left corner. It moves right, past the card's checkbox, on touch screens and on selected cards, where Stash shows the checkbox without hover.
- **Tags** are purple chips with an ink outline; badges follow the palette.
- **Navigation**: the active page is a pink pill, the brand gets the cherry, and the bar sits on an ink line over a pink rule.
- **Overlays** (menus, modals, toasts, tooltips) are raised plum stickers. Tooltips are ink with lime text.
- **Loading** is a gum bubble that swells and pops in place of Bootstrap's spinner.
- **Stash-box screens** (the Tagger, scrape dialogs and StashID links) are where people clear hundreds of rows, so Tagger rows are flat plum panels that never tilt or lift. The chosen match, button or select, is pink candy. The winning side of a scrape dialog gets a lime toggle and a lime field edge. StashID links are a chip with the stash-box name on pink and the ID on plum.

## Motion

Motion is quick and bouncy (`--juicy-ease-bounce`, 120 to 220ms). Rating, favouriting and bumping the O counter throw a burst of hearts, sparkles and drips. All animation stops when the viewer's system asks for reduced motion, and when the Calm mode setting is on.

## Copy

Cheeky copy swaps a short list of Stash's own messages for flirtier ones (the list is `CHEEKY_COPY` in `src/js/juicy.js`). Matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", also gets the mascot and "Nothing juicy here. Yet." The Plain labels setting turns all of it off, leaving a heart on an empty list.

## SFW mode

Stash's SFW content mode keeps Juicy's colours and drops the cheek: cheeky copy is off, bursts lose their drips, the empty state shows a heart instead of the mascot, and Stash's own SFW icon swap (a thumbs-up for the O counter) is left alone.

## Insights and Performers Toolkit

[Insights](https://gitlab.com/allisless0/stash-plugins) (a stats dashboard on Stash's Stats page) and Performers Toolkit (a page at `/performerstoolkit`, a strip under a performer's name, Stats and Catalog tabs on the performer's page, a button on the Performers list and a toast) come from another author's suite of plugins. Each paints itself in the Flexoki palette through custom properties it sets on its own roots (`#insights`; `.pt`, `.ptc`, `.pt-strip`, `.pt-entry` and `#pt-toast`): `--bg`, `--bg2`, `--ui` to `--ui3`, `--tx3` to `--hi`, eight accents from `--re` to `--ma`, and in Insights `--up`, `--down`, `--o` and `--otx`. Each adds its stylesheet to the page after Juicy's, so `82-insights.css` and `83-performers-toolkit.css` start their rules at `#root` (or at the id of a root that sits on `<body>`), which outranks theirs.

With the Restyle Insights and Performers Toolkit setting on, `juicy.js` puts `.juicy-restyle` on `<html>`, and both take the candy:

- **Their palette** becomes Juicy's: plum cards in deep plum wells, Juicy's text tones, and a candy colour for each tab. In Insights, You is pink, Actions coral, Library tangerine, Files cyan, Metadata health gold, Collection lime and Movies purple; in Performers Toolkit, Find is blueberry, Performers pink, History purple and Sources lime. O's are bubblegum, as on the O counter. Their own rules keep painting from these properties, so everything they colour through them follows, their charts and rings included. Their `--acc`, which each sets per tab, is left to them.
- **Their slabs go**: Insights' dashboard and the toolkit's page drop their dark panel, and their cards sit on the polka dots as plum stickers on the hard ink drop. Cards never tilt, since a dashboard is read; clickable Insights tiles take the lime halo on hover. A tile's colour edge loses its glow, and a toolkit card's coloured top edge becomes a candy lip inside the ink outline.
- **Their heads** set the name in Fredoka on an ink drop, and their tabs are candy pills on a plum tray, the open one filled with its tab's colour. On phones, where both set their tabs out in rows, the tray takes a card's corners. The toolkit's tabs on a performer's page are Stash's own and already Juicy's.
- **Fields, chips and switches** are deep plum with a plum line, and the chosen chip, step or dimension is pink candy, like Stash's active pills. A chosen card in a list takes the lime selection edge, like the Tagger's picked match. Buttons are glossy pills on the ink drop that lift and squish: plum, pink for the one that goes ahead, coral for the one that deletes. Ticked boxes and switches are pink with ink ticks and knobs. Links are cyan and turn bubblegum; good and bad read in lime and coral.
- **Card icons, numbers and small caps** are candy stickers and Fredoka. Insights' tooltip is ink with lime text, like Stash's in Juicy; the toolkit's sheets are plum stickers with the pink ring of Stash's modals, and its toast is a raised plum sticker with its kind on a thick left edge, like Stash's toasts.

Insights writes some colours from its JavaScript as inline styles and SVG attributes. Its heatmaps, its codec and resolution colours, the colours of the toolkit plugins' cards and the segments of its splits keep Insights' tones. The empty heatmap cells, the charts' grey grid lines and labels, the growth line and the tag picked in Top tags (a `--c` on its row) are matched by their exact inline colour and moved to Juicy's; an Insights release that changes one of those values puts that one piece back in its own colour. Performers Toolkit sets its colours in its stylesheet, so its fixed colours (good, bad, link hovers, O's, the ink on its badges, its toast's and review bar's kinds) are moved by class.

The setting starts off because the two share their look with their sibling plugins (Movies Toolkit, Scenes Toolkit and others), which Juicy leaves alone, so someone who runs several of them keeps one look until they choose otherwise; one setting covers both so they never split. `juicy.js` keeps it in the browser (`localStorage`, `juicy.restylePlugins`), so a page they draw on never opens in Flexoki first, and reads the settings again on every page Stash opens, so changing it needs no reload.

One rule applies with the setting off too: Insights' What works sidebar sticks 60px from the top, 11.25px under Stash's 48.75px navbar. Juicy's bar is as tall but draws its 3px pink rule below it, so the sidebar moves to 63px. Performers Toolkit measures Stash's navbar for its toast and its review bar on a phone, so it needs nothing.

The design-system page shows neither.

## Settings

| Setting                                 | Key              | Effect                                  |
| --------------------------------------- | ---------------- | --------------------------------------- |
| Calm mode                               | `calmMode`       | Turns off Juicy's animations            |
| Plain labels                            | `plainCopy`      | Keeps Stash's own wording               |
| Restyle Insights and Performers Toolkit | `restylePlugins` | Puts those two plugins in Juicy's candy |

All three default to off, so a fresh install gets the full theme and leaves the two plugins as their author drew them.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.LoadingIndicator` and `.sfw-content-mode`. Stash changes its markup between releases (v0.29 and v0.31 both moved list layouts), so each Stash release needs a pass over the design-system page and a live check on a real library. The stash-box screens depend on `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes; the compatibility tests reach them through a mock stash-box. Image cards depend on `.image-card` and `.preview-button`. Some Stash rules outrank a plain class (`div.dropdown-menu`, favourites, range sliders, the image zoom button), and modals render outside `#root`, so Juicy's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.

The rules for the two restyled plugins target Insights 2.11.0 and Performers Toolkit 0.4.2: their custom properties, their `ins-*` and `pt-*` classes and a few of Insights' inline colours (see Insights and Performers Toolkit). The tests install those releases' files in every test Stash (`RESTYLED` in `tests/stash/companions.mjs`), and a contract test per plugin fails when a class Juicy styles stops rendering on its tour of the plugin, against `tests/insights-unmatched-baseline.txt` and `tests/performerstoolkit-unmatched-baseline.txt`, the classes the demo library never shows (Insights' toolkit hub, duplicates and movies; the toolkit's review screens, catalog cards and sheets). The nightly run opens a "Restyle <plugin>" issue when a newer release of either is out.
