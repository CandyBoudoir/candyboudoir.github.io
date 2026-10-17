# Changelog

## 0.1.3

- Brackets play the performers and scenes you haven't rated. People rate their favorites, so the rated ones won their way to nearly every final; they now play only when there aren't enough unrated ones to fill a bracket. Performers and scenes from your last three brackets of the same kind and gender sit out while others can take their places.
- The Challenge round: after the final, a champion with no rating of yours meets up to three performers or scenes you have rated, lowest rated first, until one beats it. Where it stops sets the champion's rating in Apply, and the finalist and semifinalists step down from it. A champion that beats every one gets a trophy on its performer card, "beat your favorites" in its For you line and a mark in the Hall of Fame. Rate them myself skips it.
- A loss to a rated performer or scene no longer sets a rating on its own. A first-round loser to your 5★ favorite was offered 4.5★.
- Scene brackets work the same way: scenes you have rated sit out while four unrated ones can play, so "Bracket her scenes" plays the ones you haven't rated and her rated ones wait for the champion. A champion meets the rated ones from its own list first.
- Apply bracket ratings automatically, a new switch under Settings > Plugins: closing a bracket's champion screen sets its ratings, and Cherry Pick's page keeps each batch with Undo. While nothing places the champion yet, the screen says closing would set none. It starts on, and off while Ascension, HotOrNot, Xenith or Restash's mirror writes your ratings, and follows those plugins until you set it yourself.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.39.1, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.2

- On a browser's first visit, and after a day away, For you's header says what is happening while its row of placeholder cards waits: "Reading your library: 4,500 of 25,000 scenes", then "Learning your taste from 25,000 scenes". On a library of 25,000 scenes that takes about 6 seconds. Other visits start from the browser's copy of your library, take about 2 to 3 seconds and show no line.
- While Cherry Pick is still reading your library, Bracket and Options beside the Performers and Scenes lists say so when you point at them, instead of sitting greyed out with no reason.

## 0.1.1

- Your score now shows on scenes whose only rating another plugin set: Ascension's or Xenith's Elo score, the random starting rating of Ascension's Prime tasks, or Restash's mirrored score. Cherry Pick already counted those scenes as unrated, but hid Your score on them, so the scenes Prime Unrated Scenes primed lost it. It takes the card's rating corner, where Ascension and Xenith already hide Stash's rating, and shows beside the stars on the scene page. A rating you set yourself still hides it.
- Your score's badge dims the cover behind it with a half-black background instead of a backdrop filter, which stopped a page with a few dozen badges from rendering in WebKit on Linux.
- Checked live beside Ascension 1.4.1 (its battle dialog in every mode, Performer Statistics, the Metrics Dashboard and every task, at 390px under Juicy and Leather too) and Restash 0.3.0 (its scoring with the mirror off and on, and Restore Ratings).

## 0.1.0

First release, for Stash v0.31.1, under the AGPL-3.0.

- For you, the front page's first row: 12 scenes you own, ranked by your taste, your last two weeks of watching, how long since you played each (scenes you have seen come back only if you rewatch) and a little variety, each with the reason it is there. Up to two rows follow when your watching calls for them, then the Hall of Fame.
- Your score, a likely rating learned from your ratings, how you watch and your bracket picks, on unrated scene cards and beside the stars on scene pages. It shows only once it predicts your ratings better than your average does, and it never changes your ratings.
- With fewer than 10 rated scenes, For you ranks by the performers you favorite or rate, and For you, the scene page and Cherry Pick's page say how many ratings Your score still needs, with a link to your unrated scenes and a one-click bracket.
- More like this under the player: barely played scenes in your library, then, with a StashDB key, scenes you don't have.
- Performer and scene brackets beside the Performers and Scenes lists: one click starts 16, Options picks 32 or 64, the gender and the pool. Set genders fills a short pool by hand. A bracket pairs performers or scenes you haven't rated with ones you have, shows no ratings or seeds while you pick, and offers Stash ratings for the unrated ones from where they finished against the rated ones, with a preview and Undo. A performer you haven't rated who is in two or more scenes you have rated counts as rated at the average of those scene ratings, so performer brackets have ratings to measure against when you rate only scenes; Apply never rates that performer. In a bracket where none of them counts as rated, you rate the champion and the others step down from it, marked provisional so a later bracket can correct them. Brackets pause and resume, write the results to performers' custom fields and build a Hall of Fame with Champions rounds.
- A For you line on performer pages and crowns and medals on performer cards.
- With a StashDB key: how widely a scene is held, its rank among a performer's scenes, and a performer's scenes you don't have. Connect StashDB helps you get a key and adds it to Stash.
- Not interested and Don't learn from this, eleven switches and a tag exclusion list under Settings > Plugins, and Cherry Pick's own page with Remove Cherry Pick data.
- Nothing appears while a scene plays.
- Beside Ascension, HotOrNot, Xenith or Restash: the ratings they set (the Elo scores of the first three, Ascension's Prime, and Restash's score when its mirror writes it to Stash's rating) stay out of what Cherry Pick learns. Apply never rates a record whose rating they set, and says when Ascension, HotOrNot or Xenith will pick up its ratings.
- Your score shows beside Ascension's and Xenith's badges on scene cards, crowns and medals sit above Xenith's badge on performer cards, and HotOrNot's floating button goes under Cherry Pick's dialogs so it can't cover their buttons on a phone.
- Learn from Ascension, HotOrNot and Xenith matches, a switch under Settings > Plugins that starts on: each match those plugins recorded teaches Your score and For you as half a bracket pick, and Cherry Pick's page counts them.
- Beside Stash Curator: the Scenes and Performers lists render with both installed, and Bracket on a list filtered by Curator Appeal or Curator affinity leaves that criterion out and says so in the pool's name. Cherry Pick's page and its settings ask once whether to hide Your score on cards, which carry Curator's Appeal score too: Hide on cards turns off Score badges on cards and keeps Your score on scene pages, and Keep both leaves it on.
