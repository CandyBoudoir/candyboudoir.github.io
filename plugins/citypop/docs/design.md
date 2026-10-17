# City Pop design

City Pop's look is the airbrushed dusk of 1980s Japanese city pop album covers and 80s anime cels: a night-blue sky graded into violet, a striped sunset sun, palm silhouettes and a turquoise pool, with smooth gradients, crisp offset shadows and a white four-point glint on anything glossy. Ratings are striped suns, the favourite is a glossy sunset heart and the O counter is a drop falling into a pool ripple. Cards are record sleeves, audio-only scenes are cassettes and a performer's page is the J-card of a cassette case. It stays a pastel dusk, with no neon glow and no perspective grid.

The design-system page (`design-system/index.html`, built to `dist/site/citypop/index.html`) shows all of this applied to Stash's own markup.

## Palette

Every rule in `src/css` reads these custom properties, because Stash compiles its colours from SCSS and exposes none of its own.

| Token               | Hex       | Use                                         |
| ------------------- | --------- | ------------------------------------------- |
| `--citypop-sun`     | `#FF7A6B` | Primary, active, rated                      |
| `--citypop-coral`   | `#FF8A7A` | Coral text, numbers, links                  |
| `--citypop-apricot` | `#FFB36B` | Glow, warning, the sun's top                |
| `--citypop-magenta` | `#C23A8E` | Deep sunset, the shadow under script titles |
| `--citypop-pool`    | `#4FE3DA` | Focus, switches, success                    |
| `--citypop-night`   | `#0C0E30` | Page, the sky overhead                      |
| `--citypop-panel`   | `#1A1848` | Navbar, cards, panels, menus                |
| `--citypop-raised`  | `#252262` | Secondary buttons, tabs, scrape fields      |
| `--citypop-line`    | `#3A3678` | Rules and borders                           |
| `--citypop-cream`   | `#FFF6EA` | Tooltips, the rating sticker, the spine     |
| `--citypop-text`    | `#FFF4EC` | Text, 15.3:1 on a panel                     |
| `--citypop-muted`   | `#CBC3EC` | Secondary text, 9.9:1 on a panel            |
| `--citypop-dim`     | `#A39BD3` | Dates and captions, 6.5:1 on a panel        |

The sunset is a gradient from gold through apricot, coral and pink to magenta (`--citypop-sunset`). Buttons use a shorter cut of it (`--citypop-sunset-btn`) that stops before magenta, so their navy type (`--citypop-ink`, `#1B1145`) stays at 5.7:1 or better. Pool turquoise is the second accent, kept for focus, switches and success so it never reads as an action. Status text keeps its meaning in the dusk's own tones: `--citypop-success` `#6FF0E6`, `--citypop-warning` `#FFC27A` and `--citypop-danger` `#FF7D92`.

## Type

Mr Dafoe (SIL OFL 1.1), an 80s brush script, sets the wordmark, section titles, the front page's row titles and the names on detail pages and performer cards, so it never has to carry small or long text. Jost (SIL OFL 1.1) carries everything else: headings, card and modal titles at weight 500, buttons, tags, tabs and labels in caps tracked 0.14 to 0.16em, and her lines (toasts, the loader, empty lists) in Light Italic, the thin Futura oblique of the era's liner notes. Zen Maru Gothic (SIL OFL 1.1) sets the Japanese words. Body text, descriptions and settings stay on the system font. All three ship inside the plugin (`assets/fonts`) under City Pop's own family names, because Stash's content security policy has no `font-src` and blocks font hosts.

The Japanese words are few, and each is used as people in Japan use it:

| Word         | Reading        | Meaning        | Where                                                    |
| ------------ | -------------- | -------------- | -------------------------------------------------------- |
| シティポップ | shiti poppu    | city pop       | under the wordmark on the design-system page             |
| 真夜中       | mayonaka       | midnight       | the design-system page's radio dial                      |
| 真夜中ラジオ | mayonaka rajio | midnight radio | the label on an audio-only scene's cassette              |
| A面          | ē-men          | side A         | a scene's catalogue label, and the cassette's side stamp |
| B面          | bī-men         | side B         | a performer's catalogue label                            |
| 夕焼け       | yūyake         | sunset glow    | the obi on the design-system page's record sleeve        |

Zen Maru Gothic ships as a subset holding only these 16 characters, about 3.6 KB per weight, and its `unicode-range` names them, so a browser downloads it only where one of them shows. `tools/zen-maru.sh` makes it from the fonts in the google/fonts repository at a pinned commit:

```bash
plugins/citypop/tools/zen-maru.sh
```

It runs, for weights 500 (Medium) and 700 (Bold):

```bash
uvx --from 'fonttools[woff]==4.60.1' pyftsubset ZenMaruGothic-Medium.ttf \
  --text='シティポップ真夜中ラジオ面夕焼け' --layout-features='*' --flavor=woff2 \
  --no-hinting --desubroutinize \
  --output-file=src/fonts/zen-maru-gothic/zen-maru-gothic-subset-500.woff2
```

A new Japanese word needs its characters added to `TEXT` in the script, the script run again, and the `unicode-range` in `src/css/00-fonts.css` updated.

## The dusk

The page is a fixed backdrop behind everything: night blue overhead, violet low down, a sunset glow along the bottom edge, stars, and palm silhouettes in the bottom-left corner. A striped sun sits low in the bottom-right corner, smaller and dimmer than the art. Text over its disc would be hard to read, so it sets whenever full-width content crosses the horizon.

The sun rises only where the horizon is free. Every Stash page that shows a list (`.item-list-container`), a detail page's header or body (`.detail-header`, `.detail-body`), the front page's rows (`.recommendations-container`) or the player or picture of a scene or image page (`.scene-player-container`, `.image-container`) has that content across the horizon from its top to its bottom, so on those pages the sun stays down, and it rises in Settings. One `:has()` rule decides it, the same in every browser, and the sun fades over 700ms as you move between pages. It starts down, so it never shows while a page loads. The prototype set the sun with scroll-driven animations, one view timeline per block; on Stash's real pages those always ended with the sun down, so the plugin uses the rule that gives the same result without per-scroll work.

## Motifs and glyphs

`tools/icons.py` draws every motif as airbrushed SVG: the striped sun, palms, stars, the cassette, sunglasses, Walkman headphones and a tequila sunrise. The plugin ships the sun, the backdrop palms and stars, the cassette's shell and reel (the loader and the audio-only cover), the glint and the glyphs; the other motifs appear on the design-system page only. Light on pool water is a seamless caustic tile, periodic Worley noise written at 1x, 2x and 3x as lossless WebP and drawn at its native 200px through `image-set()`, so each screen gets its own pixels and the repeat shows no seam.

The poolside at dusk and the 80s anime pin-up on her pool float were rendered locally with Qwen-Image 2512 (Apache 2.0) and cropped into record sleeves. The pool ships at 256px for empty lists. The pin-up and the large pool appear on the design-system page only, and the pin-up hides in Stash's SFW mode.

Glyphs (`glyph-*.svg`) are flat silhouettes on a 24-unit grid, used as CSS masks so one file takes any fill: `glyph-sun` and `glyph-sun-line` for a rating and an empty rating, `glyph-heart` and `glyph-heart-line` for the favourite, `glyph-splash` for the O counter and `glyph-cocktail` for the O counter in SFW mode.

## Components

- **Navigation** is the night sky with the J-card stripe band (apricot, coral, pink and violet) along its foot. The active page is a sunset sticker on a hard shadow, and the brand is chrome script with a hard horizon beside the striped sun. On an upright phone, where Stash docks the bar at the bottom, the band moves to its top edge.
- **Buttons** are glossy enamel with a white gloss over the top half and a crisp offset shadow. Primary is the sunset with navy type and a white glint on its corner; secondary is night violet; success, warning, info and danger are pool turquoise, apricot, sky blue and hot coral. Pressing pushes the button down onto its shadow, joined buttons share one shadow, and the chosen item of a group is the sunset. Stash's flat icon buttons (`.btn.minimal`) stay flat.
- **Cards** are record sleeves: a navy panel on a hard shadow, a printed white keyline inside the picture and a pressed crease for the rule. Hover lifts the sleeve off its shadow, sweeps a sunset across the picture, flashes a glint and shows the catalogue label (A面 for scenes, B面 for performers, and a number), hidden at rest so a grid never reads as a list of serial numbers. The rating is a cream cassette-label sticker set on slightly crooked, beside the card's checkbox so it never covers it. Progress is an FM dial: ticks along the band and a sunset to a white needle. Performers sign their sleeve in the script.
- **Audio-only scenes** are cassettes laid across a pool at dusk, labelled 真夜中ラジオ and stamped A面, their reels turning and their glints lit on hover. Stash has no class for these, so `citypop.js` asks Stash's GraphQL API, once per batch of new scene cards, which of the scenes on screen have no video stream and no cover of their own (`findScenes` with `is_missing: "cover"`, an empty `video_codec` and an id range), keeps the answers for the visit, and adds the cover inside the card's preview. A scene with a cover of its own keeps it. If the request fails, nothing changes.
- **Ratings** are striped sunset suns, outlined when empty. **The favourite** is a heart in outline that becomes a glossy sunset heart with a glint. **The O counter** is a drop falling into a pool ripple. **Tags** are night-violet pills with a striped sun for a dot.
- **The performer page** is an open J-card. Her picture is the cover, cut to the J-card's 2:3 and weighted to the top so any picture fits (Stash still opens the whole picture on a click). Her name runs down the spine on a cream strip with the stripes, beside the heart and Stash's buttons; the disambiguation gives way first when the name is long. Her details are the flap's track listing with dotted leaders. On a phone the spine lies flat under the cover.
- **Forms** are night-blue wells, and focus draws a pool-turquoise ring. Switches are a pool lane with a pearl float, and checkboxes fill with pool water. The list toolbar's search well and its filter keys read as one control.
- **Overlays** are navy panels on the hard shadow. Menus mark the hovered item with a sunset edge and the chosen one in sunset; tooltips are cream cassette labels; toasts carry the stripe band and say her line in light italic beside a striped sun; a modal carries the stripe band under its title.
- **Tabs** underline the open tab with one sunset bar, and a tab's count is a small night-blue well that turns sunset when open. **The pager** is one strip of night keys with the current page in sunset.
- **Loading** is a cassette with both reels turning. **Empty lists** show the empty pool at dusk on a little record sleeve, and her line.
- **Stash-box screens** (the Tagger, scrape dialogs, StashID links and Identify) are where people clear hundreds of rows, so Tagger rows are flat navy panels that never lift or sweep, and their repeated buttons keep the sunset without the glint. The chosen result takes a sunset edge and the chosen select a turquoise ring. In a scrape dialog the winning side's toggle is pool water and its field takes the turquoise ring. StashID links are a pool-blue tab with the ID on night violet.

## Motion

Motion is short and soft (`--citypop-ease`, 140 to 240ms), except the sunset sweep and the glint on a hovered card, which take a second. Rating, favouriting and bumping the O counter throw a burst of glints, little striped suns and pool drops. All animation stops when the viewer's system asks for reduced motion, and when the Calm mode setting is on; the sun then rises and sets without the fade.

## Copy

A Tokyo late-night FM host, in earnest: request postcards, the air check (taping a broadcast off the radio, as 1980s listeners did), side A and side B. She keeps you listening, praises you for it and makes you wait. The list is `FM_COPY` in `src/js/citypop.js`; matches are exact and whole-text, so titles, tags and descriptions are never touched. An empty list, where Stash shows only "0-0 of 0", gets the empty pool and "Nothing on this side. Not yet." The Plain labels setting turns all of it off and leaves the pool.

The culture is in the voice as homage: real customs of Japanese late-night radio and the cassette era, never a stock image of Japan. Any new line is checked against that.

## SFW mode

Stash's SFW content mode keeps the dusk, the suns, the hearts and the cassettes. The FM host's lines are off, bursts lose their pool drops, and the O counter is a cocktail wherever Stash still draws its own ripple glyph. Stash's own SFW icon for the O counter (a thumbs-up) is left alone. The plugin ships no figure illustration; the pin-up on the design-system page hides in SFW mode.

## Settings

| Setting      | Key         | Effect                          |
| ------------ | ----------- | ------------------------------- |
| Calm mode    | `calmMode`  | Turns off City Pop's animations |
| Plain labels | `plainCopy` | Keeps Stash's own wording       |

Both default to off, so a fresh install gets the full theme.

## Coupling to Stash

The theme targets Stash's markup as of v0.31.1. The selectors it depends on most are `.top-nav`, `.grid-card`, `.scene-card`, `.performer-card`, `.thumbnail-section`, `.scene-card-preview`, `.rating-stars`, `.rating-banner`, `.tag-item`, `.count-button`, `.favorite-button`, `.detail-header`, `#performer-page .performer-head`, `.LoadingIndicator` and `.sfw-content-mode`, plus the stash-box classes `.search-item`, `.search-result`, `.selected-result`, `.stash-id-pill`, `.scrape-dialog` and the `-select-active` classes. Stash changes its markup between releases, so each Stash release needs a pass over the design-system page and a live check.

Some couplings are specific to City Pop:

- The navbar is 60px (`--citypop-nav-height`) where Stash's is 48.75px. Stash spaces the page by its own height in several places, so `80-pages.css` moves the body padding, the filter sidebar, the sidebar toggle, the sticky detail header and selection bar, the detail page's sidebar, the task queue and the toasts to match, and on an upright phone, where Stash docks the bar at the bottom, the bottom padding and the pagination footer. A Stash release that adds a rule using 48.75px needs the same.
- The J-card rebuilds `#performer-page`'s header as a grid: the cover is the `.detail-header-image` beside `.performer-head`, and the spine is the `h2` holding the name, the disambiguation, the expand button and the heart. A Stash release that moves the name out of that `h2` breaks the spine.
- The audio-only cover sits inside `.scene-card-preview`, before `.preview-scrubber`, and finds a card's scene id in its `/scenes/<id>` link. The GraphQL question uses `findScenes`' `scene_filter` with `id`, `is_missing: "cover"` and `video_codec`; a contract test sends it to each Stash version under test.
- Stash colours the rating banner by rating class (`rating-1` to `rating-5`, `rating-100-0` to `rating-100-20`) with its own `background`, so the sticker rule names those classes too.
- Some menus and their items carry Bootstrap's `bg-secondary`, which sets their colour with `!important`, so the menu rules override it with `!important` too.
- Some Stash rules outrank a plain class (`div.dropdown-menu`, `div.react-select__control`, favourites, range sliders, the image zoom button), and modals render outside `#root`, so City Pop's rules for those use matching selectors, `#root`, or `:is(#root, .modal)`.
- A `url()` inside a custom property resolves against the stylesheet that uses it, so every rule that uses `--citypop-caustic` or `--citypop-glint` lives in `citypop.css`. The design-system page keeps its own copies of those tokens in `ds/ds.css`.

## Tools

`tools/icons.py` writes every SVG motif and glyph and the caustic tile at three densities, deterministically; run it with Python 3 and Pillow (`uv run --no-project --with pillow python -I plugins/citypop/tools/icons.py`). `tools/zen-maru.sh` makes the Zen Maru Gothic subset (see Type).
