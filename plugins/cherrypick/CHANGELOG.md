# Changelog

## 0.1.0

First release, for Stash v0.31.1, under the AGPL-3.0.

- For you, the front page's first row: 12 scenes you own, ranked by your taste, your last two weeks of watching, how long since you played each and a little variety, each with the reason it is there. Up to two rows follow when your watching calls for them, then the Hall of Fame.
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
