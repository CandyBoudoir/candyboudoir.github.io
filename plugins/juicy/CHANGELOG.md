# Changelog

## 0.5.5

Settings read from Stash's own copy, for Stash v0.31.1.

- Juicy reads its settings from the copy of Stash's configuration that Stash's own pages hold, and no longer asks Stash for them on every page. On Stash v0.30.0 to v0.31.1 a configuration query that meets a configuration write can freeze Stash until it restarts, so this lowers the risk of a freeze. A setting changed in Settings › Plugins still takes effect on the next page, and one changed in another browser at the next reload.
- Tested beside Insights 2.13.0 and Performers Toolkit 0.19.0.

## 0.5.4

Every progress bar in candy, for Stash v0.31.1.

- A running job's progress bar in Settings > Tasks fills with pink candy along a deep plum groove, its percentage in ink, as a bracket's bar in Cherry Pick does since 0.5.3. Juicy's dark resume bar for cards had filled it dark over Bootstrap's pale track, so the part already done looked empty.
- The job list in Settings > Tasks is a plum card like the others. Stash had kept it slate.
- A card's resume bar is unchanged.
- Tested beside Insights 2.13.0 and Performers Toolkit 0.19.0.

## 0.5.3

Cherry Pick 0.3.1's bracket dialogs in candy, for Stash v0.31.1.

- A bracket's progress bar fills with pink candy along a deep plum groove. Juicy's dark resume bar for cards had filled it dark over a pale track, so the matches already played looked empty.
- Tested beside Insights 2.12.1 and Performers Toolkit 0.17.1.

## 0.5.2

The picked button of a group shows, for Stash v0.31.1.

- The display mode picked in a list's toolbar (grid, list, wall or tagger) is pink candy pressed into the plum, on every list and at every width. It had looked like the modes not picked.
- The current page in a short list's page numbers is pressed in pink, and the picked Overwrite, Add or Remove in a bulk edit is pressed to magenta among the pink. Both had looked like the rest.
- Tested beside Insights 2.12.1 and Performers Toolkit 0.17.1.

## 0.5.1

Insights 2.12 and Performers Toolkit 0.13 in candy, for Stash v0.31.1.

- Insights 2.12 and Performers Toolkit 0.13 pick up Juicy's colours by themselves, so with the restyle settings off they already sit in its plum.
- With Restyle Insights on, Insights' calendars and its codec and resolution colours take Juicy's palette too, and empty days sit in deep plum.
- With Restyle Performers Toolkit on, the toolkit's new Stats tab is in candy: its figures and charts are plum stickers on a hard ink drop, with their titles and numbers in Fredoka, and O's stay bubblegum. Its Stats tab before 0.13 is no longer restyled.
- Tested beside Insights 2.12.0 and Performers Toolkit 0.13.1.

## 0.5.0

Insights and Performers Toolkit in candy, for Stash v0.31.1.

- Restyle Insights and Restyle Performers Toolkit settings put those two plugins by another author in Juicy's look: plum sticker cards on the polka dots, their names in Fredoka, candy tabs filled with each tab's colour, glossy pink and plum buttons, deep plum fields, pink chips and switches for the chosen option, cyan links, ink and lime tooltips, and a plum toast with its kind on the left edge. Each tab's colour comes from Juicy's palette, and O's are bubblegum, as on the O counter. Insights' heatmaps and its codec, resolution and chart colours keep their own tones.
- Both settings start off, and each shows in Settings > Plugins only while its plugin is on. A change takes effect on the next page you open, without a reload, and so do Calm mode and Plain labels.
- Insights' What works sidebar sticks below Juicy's pink rule, and the count on Performers Toolkit's Catalog tab stays white like the other tabs' counts, with the restyle on or off.
- Tested beside Insights 2.11.0 and Performers Toolkit 0.4.2.

## 0.4.0

A new mascot, for Stash v0.31.1.

- The cherry on empty lists is redrawn as a girl, with a purple bow on one side of her head, lashes, big glossy eyes and an open smile. Her face reads at small sizes, where the old wink and smirk blurred together.
- Her leaf grows from the side of the stem, tucked behind it. The stem's dark end had shown past the leaf's base.

## 0.3.2

Juicy moves to the CandyBoudoir plugin source, for Stash v0.31.1.

- New installs come from `https://candyboudoir.github.io/index.yml`, a source for every CandyBoudoir plugin. Juicy installed from `https://candyboudoir.github.io/juicy/index.yml` keeps updating from there.
- The plugin's link under Settings > Plugins points to Juicy's folder in the new repo.
- Juicy looks and behaves as in 0.3.1.

## 0.3.1

Fixes for card overlays, for Stash v0.31.1.

- The zoom button on image cards is a small candy sticker in the picture's bottom-right corner. It had been a big blank pink disc over the middle of every image.
- With a mouse the sticker shows when you hover the card or reach it by keyboard. On touch screens it always shows, with a bigger tap area.
- Right-clicking the picture on an image card now offers the browser's image options, such as saving it.
- The rating pill moves aside for the card's checkbox. It had covered the checkbox on touch screens and on selected cards.

## 0.3.0

Stash-box screens, for Stash v0.31.1.

- The Tagger's rows, results and match panels are plum. They stay flat, with no tilt or lift, since the Tagger is where you clear hundreds of rows.
- A Tagger match linked to a performer or studio already in Stash turns pink, like the chosen Create or Skip button. Juicy's select fill had hidden it.
- Scrape dialogs show plum fields and mark the winning value with a lime toggle and a lime field edge.
- StashID links are a candy chip with the stash-box name on pink and the ID on plum.
- Menus are plum in Stash itself. A Stash rule had kept every dropdown slate.
- Buttons joined to a field stay put on hover, and tall scrape rows keep square-ish ends.
- Tables in dialogs, the Identify task's source list, the scene edit toolbar and form validation follow the palette.
- Match icons and status text use lime, gold and Juicy's red.
- Cheeky copy for the Tagger: "Tagged and bagged", "Already spoken for" and "No match. Playing hard to get."

## 0.2.0

New sticker art, for Stash v0.31.1.

- The ten stickers have curved gloss, violet shadows and sculpted gold and lime details.
- The cherry mascot on empty lists wears a satin bow with a gold heart and a glossy smirk.
- The heart padlock has a gold heart keyhole.

## 0.1.0

First release, for Stash v0.31.1.

- Candy Boudoir look: glossy sticker cards, candy pill buttons, purple tag chips, raised plum menus and modals, and a pink-dotted plum background.
- Gold hearts replace the rating stars, and a drip replaces the O counter's drops.
- Heart, sparkle and drip bursts on rating, favouriting and the O counter.
- A gum-bubble loader in place of Stash's spinner, and a mascot on empty lists.
- Cheeky copy for a short list of Stash's messages, matched whole so titles, tags and descriptions are never touched.
- Calm mode and Plain labels settings. Stash's SFW mode keeps the colours and drops the cheek.
- Fredoka bundled in the plugin, since Stash's content security policy blocks font hosts.
