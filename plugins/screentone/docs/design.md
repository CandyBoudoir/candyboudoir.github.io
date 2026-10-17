# Screentone design

Screentone's look is a page of black-and-white manga in a seinen register: the ground is beta (solid black ink), drawn in white ink, and the one colour is a hot crimson-pink kept for what is chosen, active or hers. Cards are panels with white frames and black gutters, shading is screentone, motion is speed and focus lines, toasts and tooltips are speech bubbles, empty lists fall silent and katakana SFX letter the moments that matter. The theme carries its edge in the lettering, the motion and a tsundere voice, with no explicit imagery.

The design-system page (`design-system/index.html`, built to `dist/site/screentone/index.html`) shows all of this applied to Stash's own markup.

## Palette

Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token            | Hex       | Use                                                     |
| ---------------- | --------- | ------------------------------------------------------- |
| `--st-spot`      | `#E8173F` | The one colour: primary, active, ratings, the favourite |
| `--st-spot-hi`   | `#FF4D6D` | Red on black: numbers, focus, links (6.5:1)             |
| `--st-spot-deep` | `#B30E30` | A pressed primary button                                |
| `--st-white`     | `#FDFCF9` | White ink and paper: frames, rules, bubbles, narration  |
| `--st-beta`      | `#000000` | The page and the gutters                                |
| `--st-panel`     | `#0A0A0A` | Inside a panel                                          |
| `--st-tone`      | `#1D1D1D` | Read-only fields, the Identify button (with dots)       |
| `--st-tone-hi`   | `#2E2E2E` | The Generate button (with hatching)                     |
| `--st-line`      | `#3A3A3A` | Hairlines between rows                                  |
| `--st-text`      | `#F3F2EF` | Text, 17.7:1 on the panel                               |
| `--st-muted`     | `#B8B6B1` | Secondary text, 9.8:1                                   |
| `--st-dim`       | `#94918C` | Dates and captions, 6.3:1                               |

The spot colour sits at hue 349, apart from skin tones and from Juicy's candy pink (hue 329). On the cards it is left to the rating, the progress bar and the favourite; the resolution caption is black. Status keeps its meaning without green or yellow: success is white, warning muted grey, danger the red, each with a chip (below).

## Type

Dela Gothic One (SIL OFL 1.1), a heavy gothic with Latin and Japanese, letters the brand, section and modal titles, her name and every SFX. Caveat Brush (SIL OFL 1.1), a condensed brush hand set in caps and slanted by the browser (it has no italic and one weight), letters the bubbles, toasts, the rating caption and her lines, the way translated manga is hand-lettered. Zen Kaku Gothic New (SIL OFL 1.1) carries labels, buttons, tabs, card titles and body text at 400, 500, 700 and 900. All three ship inside the plugin (`assets/fonts`) under Screentone's own family names, because Stash's content security policy has no `font-src` and blocks font hosts.

Dela Gothic One's Japanese is several megabytes, so the plugin ships a subset that holds only the characters the theme draws: ドキッ, ジー, ニヤ, チュッ, フン, ゴゴゴ, ドン and 漫画, plus キラキラ and ぷい for the design-system page, 17 glyphs in 2 KB. `src/css/00-fonts.css` loads it under a `unicode-range` listing the same characters, and Dela's Latin and the other two fonts come from their fontsource packages. The silence (……) on the design-system page is drawn as six dots at mid-height, the way Japanese sets it, so no font ships for it; in the plugin it appears only inside drawn art.

Every Japanese word in the theme:

| Word     | Reading   | Meaning                | Where                                             |
| -------- | --------- | ---------------------- | ------------------------------------------------- |
| ドキッ   | doki'     | a jolt of the heart    | the favourite, on hover, keyboard focus and click |
| ジー     | jii       | staring                | scene cards on hover                              |
| ニヤ     | niya      | a smirk                | performer cards on hover                          |
| チュッ   | chu'      | a kiss                 | image cards on hover                              |
| フン     | fun       | hmph                   | over every toast                                  |
| ゴゴゴ   | go-go-go  | a menacing aura        | modal titles, the loader                          |
| ドン     | don       | dramatic impact        | her entrance on the performer page                |
| ぷい     | pui       | turning away in a huff | the empty-list panel                              |
| ……       | (silence) | nothing to say         | the empty-list bubble                             |
| 漫画     | manga     | manga                  | the imprint label by the brand                    |
| ドキドキ | doki-doki | a pounding heart       | audio-only covers on the design-system page       |
| キラキラ | kira-kira | sparkle                | the motifs on the design-system page              |

## Tone and lines

Screentone is two offset layers of the same radial-gradient dot grid, a 5px lattice at 45 degrees as cut tone has it (`--st-dots`, and `--st-dots-soft` and `--st-dots-ink` for faint white and black). Hatching is a repeating diagonal gradient (`--st-hatch`). Speed lines are three repeating gradients whose periods never line up, so the spacing reads hand-ruled (`--st-speed`). None of these need a tile, so there is nothing to keep seamless.

The tone shadow under buttons, menus and modals is a copy of the box's dots pushed down and right and masked to the L that shows past the face. Buttons and modals draw it as a pseudo-element. Stash caps every dropdown menu at 300px and scrolls it, which would clip a pseudo-element and give the menu a scrollbar, so menus, react-select menus and popovers draw their white frame and tone shadow as one border image (`tone-frame.svg`, a 25px nine-slice) set out past the box with `border-image-outset`, which neither scrolls nor clips.

## Lettering and figures

Everything is drawn, not rendered, except two figures. The glyph masks, the line overlays, the bubbles, the stars, the sweat drop and the SFX lettering are SVG, written by `tools/icons.py` from the Dela Gothic One and Caveat Brush outlines, so an SVG shown through `<img>` needs no web font. Glyphs (`glyph-*.svg`) are flat silhouettes used as CSS masks, so one file takes any fill: `glyph-star` and `glyph-star-empty` for a rating and an empty rating, `glyph-heart` and `glyph-heart-empty` for the favourite on and off, `glyph-drop` for the O counter and `glyph-sparkle` for bursts and a star's glint. `focus-overlay.svg` and `speed-overlay.svg` are the lines that rush over a card on hover.

The two figures, her stare and her glance back over her shoulder, were rendered locally with Qwen-Image 2512 (Apache 2.0); every figure is an adult woman. The hero on the design-system page layers them in panels with the tone, the frames and her line, so SFW mode can drop them and keep the page. The plugin ships one figure, a 23 KB crop of the glance in a small panel with a silent bubble and ぷい, for empty lists (`empty-panel.webp`); in SFW mode it gives way to the bubble alone (`silence.svg`). The renders themselves stay out of the repo.

## Components

- **Navigation** is a beta title band with a white rule and a hairline under it and tone fading in from the right. 漫画 (manga) sits on a red imprint label by the brand, like the box on a volume's spine. The active page is a red title slug cut on the slant.
- **Buttons** are inked boxes with a white frame and a tone shadow. Primary is the spot red, secondary is beta, Scan (success) is paper, Generate (warning) is hatched, Identify (info) is toned, and Delete (danger) is outlined in red until you hover. Hover lifts the box off its shadow, a press lands it on the shadow, and the chosen item of a group turns paper. A group casts one shadow, and buttons fused to a field cast none. Stash's flat icon buttons (`.minimal`, `.btn-minimal`) stay flat.
- **Cards** are manga panels: the picture and the caption are two frames split by a black gutter that cuts the outer frame. On hover the frame thickens and lines rush in over the picture for a beat, speed lines on scenes and focus lines on performers and images, with ジー, ニヤ or チュッ; galleries, studios, tags and groups take the lines without a word. The studio is a paper narration box, resolution and length a black caption, and the rating a red caption cut on the slant, to the right of the card's checkbox. Titles stop at two lines, and the hatched card rule sits at the foot of the caption panel, so the counts stay level along a row. The zoom button on image cards is a small paper bubble in the picture's bottom-right corner, shown on hover with a mouse and always on touch screens.
- **Ratings** are inked stars in the spot colour, outlined in white so the red reads on black, and each filled star catches a glint now and then. **The favourite** is a heart: it pounds twice on hover or keyboard focus, and ドキッ pops beside it on hover, keyboard focus and click; on a touch screen, where a tap leaves a sticky hover, it flashes once and goes. **The O counter** is the anime sweat drop.
- **Tags** are caption boxes with a scrap of tone in the corner that turn paper on hover.
- **Forms** are boxes ruled in white ink, and focus throws a red offset. Switches are a ruled track with a square white knob.
- **Overlays**: menus are panels with the tone shadow, the tooltip is a small bubble, and toasts are speech bubbles with a tail and フン over each; a warning or an error rings its bubble in red. A modal is a panel ruled off by speed lines under its title, with ゴゴゴ brewing in the corner.
- **The performer page** opens as a two-panel spread. Her picture fills a panel cut on the slant and cropped from the top, so faces stay in; her name is lettered in the next panel across a leaning gutter, ドン breaks the frame between them, and her details sit in a paper narration box in the corner of her panel. Both panels span the same grid rows, so the two slanted edges stay parallel at any height. On a phone the spread stacks, and the gutter leans across the width instead. The cards below stay square.
- **Loading** is focus lines spinning in held frames, like limited animation, with ゴゴゴ shaking beside them and her line in a bubble. **Empty lists** show her panel and a line in the bubble lettering.
- **Stash-box screens** (the Tagger, scrape dialogs, StashID links and Identify) are where people clear hundreds of rows, so Tagger rows are flat panels with no tone, no lines and no motion, and cards inside the Tagger keep still. The chosen result takes a red edge and the chosen select a red offset. Verdicts are chips in black, white and the red: a match is a white box with a black tick, a near miss an outlined box with a bang, a failure a red box with a cross. In a scrape dialog the winning side's toggle turns paper. StashID links are a paper caption with the ID on beta.

## Motion

Motion is short and snappy (`--st-snap`, 120 to 200ms), and the loader turns in held frames (`steps(9)`) like limited animation. Rating, favouriting and bumping the O counter throw a burst of white sparkles, red stars, sweat drops and focus-line streaks that point the way they fly. All animation stops when the viewer's system asks for reduced motion, and when the Calm mode setting is on; the card lines then stay away. Stash fades its loader in with an animation, so with motion stopped the loader is shown outright.

## Copy

Her lines are a tsundere's, manga's own brat: huffy, teasing and secretly pleased, with one "baka" in the whole theme, as translated manga keep it (the list is `TSUNDERE_COPY` in `src/js/screentone.js`). Matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", also gets her panel and "Empty. Ask nicely next time." The Plain labels setting turns all of it off, and an empty list then shows the panel over Stash's own words.

## SFW mode

Stash's SFW content mode keeps the ink, the tone and the stars and drops the voice and the figure: the copy is off, cards, toasts and the favourite lose their SFX, bursts keep only sparkles and streaks, and an empty list shows the silent bubble without her panel. Stash's own SFW icon for the O counter (a thumbs-up) is left alone.

## Settings

| Setting      | Key         | Effect                            |
| ------------ | ----------- | --------------------------------- |
| Calm mode    | `calmMode`  | Turns off Screentone's animations |
| Plain labels | `plainCopy` | Keeps Stash's own wording         |

Both default to off, so a fresh install gets the full theme.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.card-section`, `.rating-stars`, `.rating-banner`, `.studio-overlay`, `.tag-item`, `.count-button`, `.favorite-button`, `.toast-header`, `.LoadingIndicator` and `.sfw-content-mode`, the performer page's `#performer-page .detail-header`, `.detail-container`, `.detail-header-image`, `.performer-head`, `.alias-head`, `.quality-group`, `.detail-group` and `.details-edit`, and the stash-box classes `.search-item`, `.search-result`, `.selected-result`, `.include-exclude-button`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes. Stash changes its markup between releases, so each Stash release needs a pass over the design-system page and a live check.

Some couplings are specific to Screentone:

- The navbar is 60px (`--st-nav-height`) with a double rule 6px below it, where Stash's bar is 48.75px. Stash spaces the page by its own height in several places, so `80-pages.css` moves the body padding, the filter sidebar, the sidebar toggle, the sticky detail header, the task queue and the toasts by `--st-nav-clear`, and on an upright phone, where Stash docks the bar at the bottom, the bottom padding and the pagination footer. A Stash release that adds a rule using 48.75px needs the same.
- Stash's performer header nests the head in a `.row` and the buttons in a `.col > .row`. The spread opens them with `display: contents` so every part can take a grid cell, and resets the Bootstrap row margins inside. Stash prints aliases in a bare `div` holding `.alias-head`, which the grid places by `:has()`. The spread skips the edit form (`.detail-header.edit`).
- Stash shows the blurred background image on detail pages only when Enable background image is on (`enablePerformerBackgroundImage` and its siblings in the UI settings). The theme keeps it, in grey under a tone, rather than hiding it.
- Stash's include and exclude toggles in the Tagger are `.btn-minimal` (a react-bootstrap variant), not `.minimal`, so the inked button rules skip both.
- Stash colours the linked Tagger select through `.search-result .performer-select-active .react-select__control`, three classes deep, so the theme's rule names `.search-result` too.
- Some menus and their items carry Bootstrap's `bg-secondary`, which sets their colour with `!important`, so the menu rules override it with `!important` too. Some Stash rules outrank a plain class (`div.dropdown-menu`, `div.react-select__control`, favourites, range sliders, the image zoom button, `.job-table.card`), and modals render outside `#root`, so Screentone's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
- Stash's loader starts at opacity 0 and fades in through an animation, so the rules that stop all animation in Calm mode and under reduced motion show it at full opacity.
- Bootstrap draws a dropdown toggle's caret in `::after`, which inked buttons spend on the tone shadow, so the caret moves to `::before`.

## Tools

The scripts in `tools/` reproduce every shipped file from the bundled fonts, and each writes the same bytes on every run. They need Python 3 with fonttools (and brotli for WOFF2), which `uvx` provides without installing anything; `hero.py` also needs Pillow. Run them from the repo root after `pnpm install`:

```bash
uvx --from 'fonttools[woff]==4.66.1' python -I plugins/screentone/tools/sfx-subset.py
uvx --from 'fonttools[woff]==4.66.1' python -I plugins/screentone/tools/icons.py
uvx --from 'fonttools[woff]==4.66.1' --with pillow python -I plugins/screentone/tools/hero.py <renders-folder>
```

- `sfx-subset.py` cuts the Dela Gothic One subset (`src/fonts/dela-gothic-one/dela-gothic-one-sfx-400-normal.woff2`) from the three fontsource chunks that hold the characters, keeping only those glyphs, and fails if one is missing. Add a character to its `TEXT` and to the `unicode-range` in `00-fonts.css` together.
- `icons.py` writes the glyph masks, the line overlays, the menu frame and the silent bubble to `src/icons`, and the motif and SFX sheets to `design-system/ds/motifs`.
- `hero.py` crops the two figures from their renders into the design-system hero (`design-system/ds/hero`) and the empty-list panel (`src/icons/empty-panel.webp`).
