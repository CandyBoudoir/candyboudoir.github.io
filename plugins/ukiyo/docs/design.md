# Ukiyo design

Ukiyo's look is an ukiyo-e night print of Edo: a Prussian-blue sky graded to near black, indigo washi paper, cream cartouches with sumi keylines and vermilion for what is chosen. Ratings are cherry blossoms, the favourite is a red seal carved with 恋 (koi, romantic love) and the O counter is a breaking wave. Its signature is the misregistered block: whatever is chosen is printed a few pixels out of register, the way a misaligned block prints, and hover slips other blocks the same way. The voice is the oiran's, a high-ranking courtesan of the Yoshiwara, taken from the quarter's real customs.

The design-system page (`design-system/index.html`, built to `dist/site/ukiyo/index.html`) shows all of this applied to Stash's own markup, with every Japanese word the theme uses and its reading.

## Palette

Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token            | Hex       | Use                                                    |
| ---------------- | --------- | ------------------------------------------------------ |
| `--ukiyo-shu`    | `#B9381F` | Vermilion: primary, active, chosen. Kinari on it 4.8:1 |
| `--ukiyo-shu-hi` | `#F2694C` | Vermilion text, numbers, focus rings (5.6:1)           |
| `--ukiyo-bero`   | `#1F4F8F` | Prussian blue: the sky, the waves, info                |
| `--ukiyo-sakura` | `#F2A7B5` | Cherry pink: blossoms, petals, resolution tags         |
| `--ukiyo-kinari` | `#EFE4CC` | Cream: text (13.5:1 on indigo), cartouches, toasts     |
| `--ukiyo-ki`     | `#C99A3E` | Ochre and mica: small highlights only                  |
| `--ukiyo-sumi`   | `#15110F` | Sumi ink: keylines, text on cream (14.4:1)             |
| `--ukiyo-ai`     | `#121C31` | Indigo washi: cards, panels, menus                     |
| `--ukiyo-ai-hi`  | `#1B2944` | Raised indigo: secondary buttons, tags                 |
| `--ukiyo-night`  | `#080D18` | The page, under the bokashi                            |
| `--ukiyo-muted`  | `#B5AE9F` | Secondary text (7.7:1 on indigo)                       |
| `--ukiyo-dim`    | `#8F97AD` | Dates and captions (5.8:1 on indigo, 5.0:1 raised)     |

Prussian blue and indigo carry the page, cream carries names and notices, and vermilion marks what is chosen, active or hers. Status text keeps its meaning in soft tones: `--ukiyo-success` `#9CCF8A`, `--ukiyo-warning` `#E6B45A` and `--ukiyo-danger` `#F0788A`.

## Type

Shippori Mincho B1 (SIL OFL 1.1), a mincho drawn after old letterpress, sets the wordmark, section, card and modal titles, cartouches, toasts and her lines, at weights 500, 700 and 800. Zen Kaku Gothic New (SIL OFL 1.1) in letterspaced caps sets buttons, tags, tabs, labels and overlays, at 500 and 700. Both ship inside the plugin (`assets/fonts`) under Ukiyo's own family names, because Stash's content security policy has no `font-src` and blocks font hosts. Only their Latin subsets ship. Body text, descriptions and settings stay on the system font.

The theme prints two Japanese words, both on seals: 浮世 (ukiyo, the floating world) on the seal beside the wordmark and 恋 on the favourite. Their kanji are outlines drawn from Yuji Syuku (SIL OFL 1.1), a brush face, placed into the seal SVGs by `tools/motifs.py` from `tools/kanji.json`, so no Japanese font ships at all. The design-system page lists the other words its notes use with their readings, set in the viewer's own Japanese system font.

## Materials

The paper is washi: a seamless overlay of long, translucent kōzo fibres, a few faint bark flecks and a cloudy formation, on transparent, laid over any flat colour (`var(--ukiyo-washi), <colour>`). It comes from `tools/washi.py`, where every fibre is drawn at all nine wrap offsets and the formation is periodic noise, so copies meet without a seam. Four rules keep it seamless:

- Tiles are lossless WebP. Lossy compression alters edge pixels and draws a faint line at every repeat.
- Each screen density gets its own file at the exact CSS size (256px) through `image-set()`, so a phone shows the fibres at its own pixels instead of an upscaled 1x tile.
- A tile is always drawn at its native `background-size`. Resampling at the edges brings the seam back.
- Phones are checked with Playwright's WebKit and `devices['iPhone 13']`, not only a narrow Chromium window.

Menus, modals, the filter sidebar and the toolbar add a faint hemp-leaf pattern (asanoha) and a double rule. Wave scales (seigaiha) run along the foot of the navbar, the performer header and every modal title. Cards and pictures take hand-cut keylines (`keyline-card.svg`, `keyline-sumi.svg`): a 3px border image whose inner edge swells and thins along its length and softens at the corners, as a knife cuts a block. Buttons keep plain, even keylines. All three patterns and both keylines come from `tools/patterns.py`.

## The prints

Two prints were rendered locally with Qwen-Image 2512 (Apache 2.0): a night print of a canal under the moon, with a bridge, lanterns, cherry blossom and a breaking sea, and a beauty print (bijin-ga) of a courtesan. `tools/crops.py` cuts the night print into the lantern row at the right end of the navbar, the sea along the foot of the page (its alpha baked in, so text stays easy to read over it) and the night canal the loader frames, and scales the beauty print to 420px wide for empty lists. The whole night print appears on the design-system page only, which keeps the plugin small. The renders themselves stay out of the repo.

## Motifs and glyphs

The motifs are drawn as a printer cuts them, flat colour inside a sumi keyline (`tools/motifs.py`): the breaking wave with clawed foam, the cherry blossom, the folding fan (sensu), the paper lantern (chōchin), the red seal carved with 恋 and the moon behind mist. The controls use them as glyphs. A filled blossom paints itself as a background (`glyph-sakura.svg`), and an empty one is a keyline mask (`glyph-sakura-line.svg`) in cream. The seal is `hanko.svg` when set and a keyline mask (`glyph-hanko-line.svg`) when unset. The O counter is `glyph-wave.svg`, and bursts throw `petal.svg`, blossoms, foam and mica.

## Components

- **Navigation** is the ichimonji bokashi band across the top of a print, dark at its top edge and blue at its foot, with the lantern row at its right end and wave scales along its foot. The active page is a vermilion block printed out of register, and the wordmark is a cream cartouche signed with the 浮世 seal. On a phone held upright, where Stash docks the bar at the bottom, the waves move to its top edge, the bokashi turns over and the lanterns hang from its foot.
- **Buttons** are flat blocks of colour (`::before`) inside a sumi keyline (`::after`). On hover the block slips 3px right and 2px down while the keyline stays; the chosen button of a group stays out of register at rest, and pressing lands the block back in register. Primary is vermilion with a reserved inner line like the border of a seal, secondary is indigo, and success, warning, info and danger are grass green, ochre, Prussian blue and deep beni red. A dropdown's caret is printed on its block, since `::after` is the keyline.
- **Cards** are washi with the picture framed like a print on its paper, an ichimonji shade across the top of the picture and hand-cut keylines round both. On hover a vermilion block slides out of register behind the card. A scene or image title is plain display type at rest and prints its cream cartouche on hover, so a grid of forty stays calm; a performer's name keeps its cartouche at rest, as a bijin-ga names its sitter. The rating hangs on a vermilion tanzaku, the slip a poem is written on, to the right of the card's checkbox. The card rule is a plain hairline.
- **Tags** are indigo slips with a vermilion dot.
- **Forms** are sunk into the indigo. Focus prints the field out of register: its keyline turns to paper and a vermilion block with a sumi edge lands 5px right and 4px low. Switches carry a moon across a sky that turns red.
- **Overlays**: menus and modals are washi with the hemp-leaf pattern, tooltips and toasts are cream slips with a keyline, and a toast is stamped with the seal. A modal's title sits in a cartouche over a band of wave scales.
- **The performer header** is a night print: a bokashi sky, the moon and wave scales at its foot. Her picture is framed on its paper, tilted a degree, with a hand-cut keyline and a vermilion block out of register, and her name sits in a cream cartouche. Her details are a ruled ledger. Stash's own Enable background image setting (Interface > Detail Page) still decides whether her blurred picture shows; when it does, it is only a faint grey tone in the sky, so any picture works. The same header dresses studio, tag and group pages, with their names in plain display type.
- **Stash-box screens** (the Tagger, scrape dialogs, StashID links and Identify) are where people clear hundreds of rows, so Tagger rows are flat and never lift, and cards inside the Tagger keep still. The chosen result is printed out of register like every chosen thing, a sumi keyline with a vermilion block behind it, with no motion. In a scrape dialog the winning side's toggle is printed in vermilion. StashIDs carry a cream cartouche for the stash-box and indigo for the ID.
- **Lists**: the toolbar is a washi panel with a double rule, and the search field and the filter buttons beside it print as one block. The count of a list is set in the display face. In the pager the current page, Stash's count in the middle, is printed in vermilion and out of register.

## Motion

Motion is slow and soft (`--ukiyo-ease`, 160 to 280ms). Rating, favouriting and bumping the O counter scatter petals, blossoms, foam and flecks of mica, which drift down. The seal stamps itself on under the pointer, never on page load. The loader's lantern sways, a petal falls past and moonlight drifts across the canal. All animation stops when the viewer's system asks for reduced motion, and when the Calm mode setting is on.

## Copy

The oiran's copy swaps a short list of Stash's own messages for her lines (the list is `OIRAN_COPY` in `src/js/ukiyo.js`). Matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", gets the beauty print and "Come back a third time. Then, perhaps." The Plain labels setting turns all of it off, the beauty print included.

Every line comes from something real in the floating world or the printing craft, never from her costume: a courtesan of her rank did not speak to a patron at their first meeting (shokai), accepted him only on his third visit (najimi), could refuse him outright, and sealed her letters in red; blocks are cut, ink dries and a print is sealed. Culture belongs in the voice as homage, never as caricature, so any new line needs a specific, true source in the Yoshiwara's customs or the printer's craft, and stock images (grooming and costume, ritual patience, inscrutability, broken English) are out. The library's own tags decide what she wants.

## SFW mode

Stash's SFW content mode keeps the print, the blossoms, the seal and the wave, and drops her voice and every figure: the copy is off and the beauty print never shows. Stash's own SFW icon for the O counter (a thumbs-up) is left alone.

## Settings

| Setting      | Key         | Effect                                              |
| ------------ | ----------- | --------------------------------------------------- |
| Calm mode    | `calmMode`  | Turns off Ukiyo's animations                        |
| Plain labels | `plainCopy` | Keeps Stash's own wording, without the beauty print |

Both default to off, so a fresh install gets the full theme.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.card-section-title`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.detail-header`, `.detail-header-image`, `.performer-head`, `.filtered-list-toolbar`, `.page-count-container`, `.LoadingIndicator` and `.sfw-content-mode`, plus the stash-box classes `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes. Stash changes its markup between releases, so each Stash release needs a pass over the design-system page and a live check.

Some couplings are specific to Ukiyo:

- The navbar is 66px (`--ukiyo-nav-height`) where Stash's is 48.75px. Stash spaces the page by its own height in several places, so `80-pages.css` moves the body padding, the filter sidebar, the sidebar toggle, the sticky detail header, a list's sticky selection toolbar and the task queue to match, and on an upright phone, where Stash docks the bar at the bottom, the bottom padding and the pagination footer. A Stash release that adds a rule using 48.75px needs the same. Between 1200px and 1500px the navbar's links sit closer, so the tracked caps leave room for the utility buttons.
- Buttons draw their block and keyline in `::before` and `::after`, so the theme repaints Bootstrap's dropdown caret on the block and switches the pseudo-elements off on the chrome Stash renders as buttons (the detail dividers, the scrubber arrows, the image zoom button).
- The detail header's art is the header's own background, and the background-image container Stash adds when its setting is on is blended in at 10% luminosity, so the setting keeps working.
- Some menus and their items carry Bootstrap's `bg-secondary`, which sets their colour with `!important`, so the menu rules override it with `!important` too.
- Some Stash rules outrank a plain class (`div.dropdown-menu`, `div.react-select__control`, favourites, range sliders, the image zoom button), and modals render outside `#root`, so Ukiyo's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
- A `url()` inside a custom property resolves against the stylesheet that uses it, so every rule that uses `--ukiyo-washi`, the patterns or the keylines lives in `ukiyo.css`. The design-system page keeps its own copies of those tokens in `ds/ds.css`.

## Tools

The scripts in `tools/` need Python 3; `washi.py` and `crops.py` also need Pillow.

- `washi.py OUTDIR` writes the three washi tiles as lossless WebP.
- `patterns.py OUTDIR` writes the seigaiha, asanoha and chevron SVGs and the two hand-cut keylines.
- `motifs.py OUTDIR` writes the motifs and glyphs, placing the kanji from `kanji.json`, which holds the outlines of 恋, 浮 and 世 from Yuji Syuku in font units (license in `kanji-OFL.txt`). `geom.py` holds its geometry helpers.
- `crops.py RENDERS_DIR OUT_DIR` cuts the two renders into the crops the theme uses and the whole night print for the design-system page.

`washi.py`, `patterns.py` and `motifs.py` reproduce the shipped tiles and SVGs byte for byte.
