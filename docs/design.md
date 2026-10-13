# Juicy design

Juicy's look is Candy Boudoir: the colours and gloss of a candy shop, with a little boudoir cheek in the wording, the motion and the small details. Naughtiness lives in words, motion and motifs (cherries, lips, drips, hearts) and never in explicit imagery. Two sticker illustrations, a bubblegum-blowing pink head in a lime crown and a heart padlock with a gold key, set the style. They belong to the author's own collection and do not ship; every Juicy icon is drawn from scratch in SVG.

The design-system page (`design-system/index.html`, built to `dist/site/index.html`) shows all of this applied to Stash's own markup.

## Palette

Sampled from the sticker references. Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token                 | Hex       | Use                                          |
| --------------------- | --------- | -------------------------------------------- |
| `--juicy-pink`        | `#FC3D9F` | Primary buttons, active nav, the brand       |
| `--juicy-bubblegum`   | `#FC68B2` | Hover states, highlights, the loader         |
| `--juicy-magenta`     | `#DD2A97` | Pressed states, gradient shadows             |
| `--juicy-lime`        | `#D7FA54` | Card hover halo, focus rings, selection      |
| `--juicy-gold`        | `#FDDA4E` | Rating hearts and rating badges              |
| `--juicy-cyan`        | `#00A8F0` | Links, info                                  |
| `--juicy-purple`      | `#9B30FF` | Tags and secondary chips                     |
| `--juicy-danger`      | `#FF5A4E` | Destructive actions, kept clear of the pinks |
| `--juicy-ink`         | `#010224` | Outlines, hard drop shadows, text on candy   |
| `--juicy-bg`          | `#150A2E` | Page background, with pink polka dots        |
| `--juicy-card`        | `#22123F` | Cards, panels, sidebars                      |
| `--juicy-card-raised` | `#2D1852` | Menus, secondary buttons, toasts             |

Text on candy fills (pink, lime, gold, cyan, danger) is ink, which keeps contrast at 6:1 or better. Text on plum is `--juicy-text` (`#FFF2FA`).

## Type

Fredoka (SIL OFL 1.1) sets headings, card titles, buttons, chips and badges. It ships inside the plugin (`assets/fonts`) because Stash's content security policy has no `font-src` and blocks font hosts. Body text, descriptions and settings stay on the system font.

## Stickers and glyphs

Stickers are the decorative icons: `mascot`, `cherry`, `heart`, `lips`, `heart-lock`, `crown`, `bubble`, `drip`, `sparkle`, `bolt`. Each is drawn on a 64-unit grid inside a `-4 -4 72 74` viewBox and built from the same four layers, back to front:

1. A soft ink drop: the shape stroked 10 wide in ink at 45% opacity, offset 3 down.
2. The lime cut edge: the shape stroked 10 wide in lime (the bolt uses pink, so it reads against its own lime body).
3. The body: a glossy radial or linear gradient with a 3.5 ink outline.
4. The relief and shine: clipped violet shadows on pink candy, facets on gold and lime, and curved cream reflections that follow each shape. Smaller rim reflections keep the volume readable on dark backgrounds.

The mascot adds a satin bow with a gold heart, violet eyes, a wink and glossy lips. Its face stays readable at 32px; larger empty states reveal the bow folds and cheek highlights. Decorative stickers remain transparent vectors with local references only. Keep the mask glyphs flat so their silhouettes stay clear at control sizes.

Glyphs (`glyph-*.svg`) are flat silhouettes on a 24-unit grid. The theme uses them as CSS masks over `currentcolor`, so one file serves every colour: hearts replace the rating stars, the drip replaces the O counter's drops.

## Components

- **Buttons** are glossy pills with an ink outline on a hard 3px ink drop. They lift 2px on hover and squish on press. Stash renders its icon buttons as `.btn.btn-primary.minimal`; those stay flat and take a pink wash on hover.
- **Cards** are stickers: ink outline, 20px corners and a 5px ink drop. On hover they lift, tilt half a degree, take a lime halo, and a shine sweeps across the thumbnail.
- **Ratings** are gold hearts. The Font Awesome star paths are hidden and the svg paints a heart through a mask.
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

Stash's SFW content mode keeps Juicy's colours and drops the cheek: cheeky copy is off, bursts lose their drips, the empty state shows a heart instead of the winking mascot, and Stash's own SFW icon swap (a thumbs-up for the O counter) is left alone.

## Settings

| Setting      | Key         | Effect                       |
| ------------ | ----------- | ---------------------------- |
| Calm mode    | `calmMode`  | Turns off Juicy's animations |
| Plain labels | `plainCopy` | Keeps Stash's own wording    |

Both default to off, so a fresh install gets the full theme.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.LoadingIndicator` and `.sfw-content-mode`. Stash changes its markup between releases (v0.29 and v0.31 both moved list layouts), so each Stash release needs a pass over the design-system page and a live check on a real library. The stash-box screens depend on `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes; the compatibility tests reach them through a mock stash-box. Some Stash rules outrank a plain class (`div.dropdown-menu`, favourites, range sliders), and modals render outside `#root`, so Juicy's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
