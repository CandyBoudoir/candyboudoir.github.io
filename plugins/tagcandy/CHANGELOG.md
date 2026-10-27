# Changelog

## 0.2.0

- Explicit icons URL is now Icon overrides URL, and Tag Candy asks it for every concept, including concepts with no icon yet. Overrides can be nude versions or any other picture. Each file is named after its concept, such as `big-dick.webp`, the regular icon's name without its hash, so folders set up for 0.1 keep working. Dry run lists the file each tag asks for.
- A concept with no override (404) leaves the address in use, so a folder that holds a few overrides serves every one of them. An address that refuses Tag Candy (401 or 403) logs one warning, and a tag that already shows its regular icon is not sent it again.
- An override you replace or delete reaches its tags on the next Apply icons.
- Replace my own tag images is now a task, Replace my own images, so Apply icons never swaps an image you set. The setting is gone.

## 0.1.7

- Redrawn icons for American, Anal Demolition, British, Cock Slapping, Face Fuck, Gagging, Hard Fuck and Head Pushing Blowjob.
- Explicit icons URL now also covers Accidental Exposure, Anal Creampie, Anal Fingering, Anal Gape, Anal Winking, Ass Spreading, Big Clit, Biting Balls, Bottomless, Breast Licking and 59 more.

## 0.1.6

- New icons for Accidental Exposure, All Natural, All Sex, Anal Hooks, Anchored Bondage, Anime Character, Ankle Socks, Armbinder, Arms Restrained Behind Back, Backroom and 214 more.
- Updated which tag names and StashDB tags match Strip Poker.
- Explicit icons URL now also covers Ball Licking, Big Dick, Cum on Tits, Deepthroat, Female Masturbation, Hands Free Blowjob, Nipple Play, Oral Sex, Pink Nipples, Tit Wank and 2 more.

## 0.1.5

- Icons for new tags reads Tag Candy's settings only for a tag with no image. It had sent Stash a configuration query on every tag change. On Stash v0.30.0 to v0.31.1 a configuration query that meets a configuration write can freeze Stash until it restarts, so this lowers the risk of a freeze.

## 0.1.4

- New icons for 3D Available, Anal Creampie, Anal Stretching Toys, Argentinian, Augmented Reality, Australian, AV1, Bad Girl, Ball Gag, Ball Play and 105 more.

## 0.1.3

- New icons for Adorable, Ahegao, Airtight, Anal Fingering, Anal Winking, Armpit Fetish, Ass Grabbing, Ass Smacking, Ass Stacking, Bald Head and 92 more.
- Updated which tag names and StashDB tags match Sneakers.

## 0.1.2

- New icons for 69, American Porn, Anal Demolition, Anal Gape, Anal Stretching, Artistic, Average Body, Average Height, Award Winner, Ballerina Position and 70 more.

## 0.1.1

- New icons for Age Gap, Animation, April Fools, Average Dick, Bait, Big Black Cock (BBC), Big Clit, Big White Cock (BWC), Birthday, Biting Balls and 59 more.
- Redrawn icons for Ass Denial, Ass Shaking, Bare Bottom, Booty and Soles, Chastity, Feet, Solo, Threesome, Tight Clothes, Trampling and 2 more.
- Updated which tag names and StashDB tags match First Gay, Roleplay, Straight Stud and Superhero.

## 0.1.0

First release, for Stash v0.31.1.

- Glossy sticker icons for tags, matched by Extra matches first, then the tag's StashDB link, then its name and aliases. Case, punctuation and accents make no difference.
- Stash downloads each icon from candyboudoir.github.io, so the plugin holds the script alone, and Stash runs that script itself with nothing else to install.
- Apply icons fills tags with no image and keeps Tag Candy's own icons current. Dry run shows what it would do and lists the tags that match nothing.
- New, renamed and merged tags get their icon as they appear, unless Leave new and renamed tags alone is on.
- Images you set stay. Replace my own tag images swaps them too on an Apply you start, after copying each to a backup tag; Restore replaced images and Delete backups undo and tidy up. On a Stash with a password this needs an API key.
- Remove Tag Candy icons clears Tag Candy's icons and leaves every other image.
- Explicit icons URL shows nude versions you keep yourself, from a web address or a folder your Stash serves.
