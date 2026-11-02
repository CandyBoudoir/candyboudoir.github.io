# Changelog

## 0.6.2

- Clear in the For you tab keeps the search cleared. On Stash 0.32, which runs React 18, a busy page could put the search you had just cleared back into the box and the address a moment later, and the tab then showed that search's scenes, or none with another filter on. Stash 0.31 is not affected.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.52.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.6.1

- Under Reasons on cards: Icon, the More with and Back to rows on the front page show an icon on each cover, as For you does, and pointing at it, or tapping it on a phone, shows the whole reason. In 0.6.0 they showed no reason. Their icons are the seedling for a scene you haven't watched, the clock for one you haven't watched in a while and the cherries for your taste. The icon moves up a line when something else holds the cover's bottom left, and under Refract it is the first of Refract's pills, as in For you. Text and Off are unchanged.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.52.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.6.0

- Reasons on cards, under Settings > Plugins > Cherry Pick, sets how Cherry Pick says why a scene is in its rows: Text, Icon or Off. Text, the default, keeps the line under each card. Icon puts one icon at the bottom left of each cover in For you, on the front page and in the For you tab's Grid, and pointing at it, or tapping it on a phone, shows the whole reason. The arrow is for what you watched lately, the seedling for a scene you haven't watched, the clock for one you haven't watched in a while, the cherries for your taste and the flask for one to try. With Icon the other rows show no reason, since their titles say why, and neither does New in your library, which takes For you's place in a library under 30 scenes. Off shows no reasons on Cherry Pick's cards. Watch This's line, "likely 4★ for you" and the score badge's hover keep theirs.
- The icon moves up a line when something else holds the cover's bottom left: an interactive scene's funscript speed, Xenith's rank, Ascension's score or Stash Curator's Appeal. Under Refract's card style, which lays the title over the foot of the cover, the icon is the first of Refract's pills instead.
- Each page of the For you tab varies its reasons as the row does, so a page no longer gives most of its cards the same sentence. The scenes keep their order.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.52.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.5.1

- Cherry Pick's rows and Stash Curator's lanes both show on the front page. From Curator 0.47.0, Curator puts its lanes among Stash's own rows, and each plugin added its rows only where it found Stash's rows as Stash draws them, so the plugin Stash loaded second no longer found Stash's rows where it looked and added none of its own. Depending on the order, Cherry Pick's rows or Curator's lanes were missing. Cherry Pick now looks for Stash's rows inside Curator's too, and Curator still finds them beside Cherry Pick's, so both show, Cherry Pick's first, and Customise works as before.
- Each scene shows once in Cherry Pick's rows, on the front page and in More like this. A row looped back to its first card after its last, as Stash's own rows do, and to loop, Stash's slider copies every card to each end of the row. Stash's rows hold 25 cards, so the copies stay out of sight. Cherry Pick's hold a dozen or fewer, and when a row's cards fit the window with room to spare, the copies showed after the last card: a More with row of five scenes could show its first scenes again beside them. Cherry Pick's rows no longer loop, and their arrows stop at the first and the last card.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.49.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.5.0

- For you has its own tab on Cherry Pick's page, which the cherries in the navbar open, and View all on the For you row opens it too. The tab lists every scene For you would show, in For you's order: the row's twelve first, then the rest of your library. It uses Stash's own Grid, List and Wall, with Stash's card sizes and pages of 20, 40, 60 or 120 scenes, and each card says why it is there and has the ⋯ menu, as in the row. A click on a scene plays it, with the scenes on that page queued in For you's order. A search, Performers, Studios, Tags, Unwatched and a length narrow the tab to the scenes that fit, ranked again among themselves. The view, the page and the filters are in the page's address, so Back from a scene returns to the same place, and the tab opens in the view you used last. With For you off under Settings > Plugins, the tab goes with the row and the page opens on the Hall of Fame.
- Cherry Pick's page has three tabs, For you, Hall of Fame and Manage, each at its own address. Manage holds Your score, StashDB, Not interested, Don't learn and Remove Cherry Pick data, and links to Cherry Pick's switches in Settings > Plugins. A line above the tabs says where Your score stands, and with Brackets on it starts a performer or scene bracket, or finishes the one you paused. A link to a part of the old page, such as one you bookmarked, opens the tab that holds it.
- In a scene bracket, each cover plays the scene's preview clip, muted and on a loop, so you can see both scenes move before you pick. A click or tap on the playing cover still picks it. Pointing at a cover turns its sound on when Stash is set to play sound on previews. A clip starts once at least half the cover is on screen, so on a phone the lower scene waits until you scroll to it, and nothing loads for a cover you haven't reached. A scene Stash made no preview for keeps its cover, and with reduced motion set on your device every cover stays still. The clip is the preview Stash generated, as in Look closer, so it plays whatever the scene's format and records no play.
- The foot of Cherry Pick's page shows the version Stash has installed, with links to what's new, the forum topic and the source code, and Support Cherry Pick, which opens CandyBoudoir's Ko-fi page for anyone who wants to leave a tip. Cherry Pick is free, and a tip changes nothing in it.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.46.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.4.2

- For you stays on the front page when Stash no longer has one of its scenes, after the scene is deleted, merged into another scene or removed by Stash's Clean task. Stash turns down a request for several scenes when one of them is gone, and Cherry Pick asked for For you's twelve in one request, so the row left the page with no word until a later visit to the front page, a few minutes on. The rows after For you could go the same way, and More like this on a scene page said it found nothing like the scene. When Stash turns a request down, Cherry Pick now asks for each scene on its own and shows the ones Stash still has.
- The Hall of Fame shows its champions after one of them is merged into another performer or deleted. It said "No champions yet" for good.
- A Cherry Pick row with nothing to show stays on the front page and says why. In a library under 30 scenes, New in your library takes For you's place and leaves out scenes played in the last two weeks or rated under 3★. When that leaves nothing, the row says so and that For you starts at 30 scenes. A row whose scenes Stash didn't send asks you to reload the page.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.45.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.4.1

- More like this sits under the scene's details and player, as wide as the page, under themes that fit the scene page to the window, such as Refract. Under Refract it sat in the narrow details column instead, and the details and the player shrank to make room for it. The page now scrolls down to it.
- "likely 4★ for you" stays beside the stars under Refract. Refract draws the toolbar's buttons as small circles, and it squeezed the line into one, so its words ran over the fourth and fifth stars.
- Your score shows on scene cards under Refract, as an outlined chip in the top left corner, where Refract shows a scene's rating. Refract hid it, and read it as the scene's rating: it could frame the card as it frames a well-rated scene.
- The ⋯ menu on cards in Cherry Pick's rows is a pill over the picture under Refract, beside Refract's own pills. Refract hides the row of buttons under each card, which held the menu, so Not interested and Don't learn from this were out of reach. On a scene you don't have, the links to its store and to StashDB are pills there too, and "Not in your library" moves to the top left corner, clear of the title.
- Watch This shows its player under Refract. Refract stretches every player to fill the scene page's column, which on the front page left it no height. Refract also hides the big play button in the middle of every player, so start the pick with the play button in the player's bar, a click on the video or Space.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.45.0, Xenith 3.2.0, Restash 0.3.0-55c1cb2 and Refract 1.24.3-458b135.

## 0.4.0

- Tags Cherry Pick doesn't learn from, a new setting under Settings > Plugins, keeps every scene with one of the tags you list out of what Cherry Pick learns, as Don't learn from this does for one scene. Their plays, ratings and bracket picks teach Cherry Pick nothing, and opening or passing one in For you changes nothing. Tag the scenes in Stash, one at a time or many at once from the Scenes list, and type the tags' names into the setting, separated by commas. Cherry Pick's page counts the tagged scenes and names any listed tag no scene in your library has. The scenes can still show up in Cherry Pick's rows, which Tags to keep out of my picks controls.
- Don't learn from this leaves the scene page. Beside the stars it crowded Stash's toolbar, and under themes that narrow the toolbar, such as Refract, it could make the scene's details jump. It stays in the ⋯ menu on cards in Cherry Pick's rows, and the scenes you marked stay marked, listed on Cherry Pick's page with Learn from it again.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.41.0, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.3.3

- Brackets, a new setting that starts on, takes Cherry Pick's bracket buttons out of Stash's pages when you turn it off, for those who rank with another plugin: Bracket and Options leave the Performers and Scenes lists, "Bracket her scenes" leaves a performer's Scenes tab, For you's header offers ratings alone, and Cherry Pick's page shows no Champions round. A paused bracket stays in Stash's plugin configuration, and its Resume pill comes back with the switch. The brackets you played, a paused one's picks included, keep teaching Cherry Pick, and the Hall of Fame row, crowns and medals and the For you line keep their own switches.
- Cherry Pick sends Stash fewer configuration reads and writes, which lowers the risk of a freeze on Stash v0.30.0 to v0.31.1. Those versions can stop answering until restarted when a configuration write reaches them while they serve a configuration query or the image of a performer who has none, as the Performers list loads. Cherry Pick reads the configuration from the copy Stash's own pages hold, sends no write that would change nothing, and holds each write until the page's performer images have loaded and the page has been quiet for half a second. The settings it fills in at first load go out in one write. Reads and writes from other plugins, other browsers and Stash's own pages are out of Cherry Pick's sight, so a freeze can still happen.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.41.0, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.3.2

- A map size you haven't picked shows its mark in full while you point at it or reach it with the keyboard. Cherry Pick kept it dimmed on hover too, and under Juicy, which turns a button's mark pink on hover, the dimmed pink faded into the plum button.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.41.0, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.3.1

- Three buttons beside the speaker in a bracket's header set how much room the map takes: No map, Short map and Tall map. Tall map is 0.3.0's layout and stays the default. Short map gives the map a lower frame and the height it frees to the two cards. No map hides the map and plays the cards at Brackets Classic Mode's size, with the same animations, round title cards and sound, and Show bracket still opens the whole map. In a scene bracket, whose map is already short, Short map is a strip that shows the match being played. The Challenge round's road follows the same choice. Cherry Pick keeps it in Stash's plugin configuration, so it holds across brackets, reloads and browsers. A phone keeps its own layout and shows no buttons.
- Cherry Pick's dialogs cover the page behind them with your theme's backdrop color at 92% opacity, up from Stash's 50%.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.41.0, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.3.0

- Brackets play on a map of the whole bracket, under the match, or over it in a scene bracket. Each match pops up out of its place on the map; a pick flies the winner into its place in the next round, draws the path it took in your theme's accent color and moves Cherry Pick's cherries on to the next match. A new round opens with its name, Show bracket (or T) opens the whole map, and a map too big to read whole, on a phone or in a bracket of 32 or 64, shows at full size to scroll through. Winning a bracket lights up the champion's road to the trophy; a click or any key skips it. Sound starts off, and the speaker button or M turns it on. A game controller's d-pad picks too. A pick made while the next match is still arriving only ends its arrival, so you can't pick a match you haven't seen, and with reduced motion set on your device, matches change without moving. No card or map shows a rating or a seed.
- The Challenge round has its own map: the champion's road past each favorite to the trophy, with each favorite hidden until the champion reaches them. Beating them all lights up the road to the trophy.
- New bracket, on the champion screen, does what Done and then Bracket would do, in one click: with Apply bracket ratings automatically on, it sets the finished bracket's ratings first, then starts a bracket from the same pool, gender and size, in which the last bracket's entrants sit out while others can take their places.
- Brackets Classic Mode, a new setting that starts off, plays brackets as Cherry Pick 0.2 did, with two cards, a pick and no map, animation or sound. New bracket works there too.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.41.0, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.2.2

- For you loads again after a scene you played in a scene bracket leaves Stash: deleted, merged into another scene, or removed by Stash's Clean task. Cherry Pick stopped at the bracket's pick on the missing scene and never finished learning your taste, so For you's header said "Learning your taste from … scenes" for good, and Your score, Watch This and the bracket buttons never came. Picks on a scene Stash no longer has now teach Cherry Pick nothing. A paused bracket still shows such a scene as "A removed scene".

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.40.6, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.2.1

- Cherry Pick counts a play only as far as the time behind it. Stash records a play from a scene's first second, so a scene swiped past in a feed such as Stash TV's counted like one watched all the way through: For you put its performers, studio and tags forward as what you had been watching, ranked it lower as recently watched, and counted it as a rewatch when it came by again on another day, and Your score read the short play as a sign you disliked the scene. Each tenth of a scene's length played now pays for one play. A scene played for less than that in all was only looked at: it teaches Cherry Pick nothing, and For you and More like this say "Not watched yet". When a scene's play time pays for fewer plays than Stash records, each play, and each day it was played on, counts for that share. A scene you start on its own page and leave within its first tenth no longer counts against it either. Plays with no play time, such as plays added by hand, count as before.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.40.4, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.2.0

- Watch This, a new setting in Cherry Pick's settings, off until you turn it on, puts one scene on the front page in place of Cherry Pick's rows: the one Cherry Pick expects you most want to watch now, in Stash's own player at the page's full width. Stash's own rows stay below it. The player works as on the scene page: Stash records the play and where you stopped, Stash's Auto-start video setting decides whether the scene starts by itself, and Space plays it with no click first. A line under the player gives the scene's title, its performers and why Cherry Pick picked it, and steps out once the scene plays. Nothing happens when the scene ends. For you, the rows that follow your watching and the Hall of Fame row keep their switches for when you turn Watch This off; the Hall of Fame stays on Cherry Pick's page.
- Watch This's Skip, in the line under the player, as the player's next button or with the next-track media key, puts the scene to sleep for 48 hours and shows the next pick, one that shares no performer with the scenes you skipped that visit. A scene skipped again with no play in between sleeps for a week, then for 30 days each time; a play starts it again at 48 hours, and so does a Skip after playing at least a tenth of the scene. A shorter look before Skip doesn't count as a play. Back, in the line or as the player's previous button, brings the last skipped scene back with its sleep as it was. A pick left on screen without being played or skipped, on three different days, sleeps as if skipped. Skips teach Cherry Pick nothing and are kept in Stash's plugin configuration, so they hold on every device.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.40.4, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.8

- Your score, For you, More like this and a bracket's cards leave out the tags Advanced Rating and Binge keep for their own use: Advanced Rating's score tags, such as "Production Quality ★: 4", which Binge's stars also write when Advanced Rating is installed, and Binge's collections, such as "Watch Later 📁". Score tags sit only on rated scenes and spell out the rating, so Your score learned a rated scene's rating from them and gave the scene's other tags less weight. Two scenes in the same collection counted as sharing a tag in More like this. Advanced Rating's "Favourite ★" still counts, as your own verdict on a scene.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.40.4, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.7

- A scene you don't have links to where to get it on many more cards: its page on the clip store or tube StashDB lists it on (Clips4Sale, iWantClips, ManyVids, Pornhub and the like), with the store's name on the button. Cherry Pick took only the links StashDB files under Studio, which holds paysites; StashDB files a store's link under the store's own name, so about three in four clip-store scenes showed StashDB alone. A store's page comes before the studio's, and a Wayback Machine copy never counts. A scene already in the StashDB cache shows its studio link once more while Cherry Pick asks StashDB about it again in the background, and its store link from then on.
- Pages you have visited before show their StashDB scenes straight away, also after a week. Cherry Pick asked StashDB again for an answer over 7 days old before showing it, so More like this's scenes you don't have could take five seconds to appear. It now shows the answer it has and asks again in the background once the page's own lookups are done, within the same limits (one request a second, six per page). The new answer is kept and shows the next time Stash loads or another page asks for it, so nothing on the page changes while you look at it. Answers are kept for 30 days; an older one is asked for again before it shows.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.40.4, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.6

- Every card in Cherry Pick's front-page rows and in More like this ends at the same height, as in Stash's own rows. A card whose reason fit on one line ended about 20px above one whose reason took two, with its counts and ⋯ menu.
- A scene bracket's Look closer opens with Play the preview already under the scrub bar. It appeared a moment later the first time you looked closer at each scene, and the dialog moved up about 20px as it did, so a click or hover just after opening could land below the bar.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.40.1, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.5

- In a bracket's first round, the unrated ones meet across the bracket's halves: of 16, the one Cherry Pick rates highest meets the ninth, the second the tenth, and so on. They met their neighbour (first against second), so since 0.1.4 rates every entrant from where it finished, a strong scene or performer that lost to the next strongest in the first round was rated at about the middle of your scale.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.39.2, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.4

- More like this no longer makes the scene page scroll sideways in a desktop browser. Its arrows sat past the page's edges, the right one 10px beyond the page and the left one half off it.
- In a window or on a phone narrower than 1200px, More like this no longer covers the scene's performers. Stash keeps the scene's details to the window's height and lets the rest run past, and More like this started where that box ended.
- Your score's ribbon on scene cards runs off the picture's top and left edges like Stash's rating ribbon. Its label is shorter than Stash's "Rating: 5", so the ribbon stopped inside the picture with its end showing.
- Undo leaves alone a rating you changed by hand after Apply and says so: "Left 1 as it is: its rating changed since Apply." It used to put the rating from before Apply back over yours. The same goes for a provisional rating a later bracket stepped down again.
- Apply leaves alone a rating that changed after the bracket offered one, such as a rating you gave by hand in another tab or on Stash's own pages while the preview was open, and says so: "Left 1 as it is: its rating changed since the bracket offered one." It used to write the bracket's rating over yours. Apply bracket ratings automatically does the same.
- On a Stash whose server runs behind UTC, a rating you set on Stash's own pages, or one an earlier Apply wrote, reaches Cherry Pick at your next visit. Cherry Pick asked Stash for the scenes changed since its last look by a UTC time, which Stash compared with its own local time, so on a server at UTC−4 it found nothing for four hours and rated scenes came back as unrated in the next bracket. It now reads the latest edits, plays and Os newest first and compares the times itself. O counts reach it the same way, and it reads your whole library again once a day even when you visit every day, where each visit used to put that off. Each browser reads the library in full once after this update.
- Scene brackets draw from every scene you own, watched or not, as performer brackets draw from everyone with a photo. They drew only from scenes Stash had recorded a play for, so in a library where you mostly watch outside Stash's own player the same few scenes played in every bracket. Audio-only files and scenes marked Don't learn from this stay out.
- Each side of a scene match shows the cover and eight frames spread over the scene, its studio, year, length and resolution, up to four performers' faces and a row of tags, so you can judge a scene you have never watched. A click or a tap on the cover picks it. A frame opens one scene large at that moment, and Look closer, or 1 and 2 on the keyboard, opens it on the cover: step through its frames with the arrow keys (Shift for ten at a time) or scrub along the bar, play Stash's preview clip, and read every performer, the description and every tag. Enter picks, O switches to the other scene and Esc goes back to the match. The frames and the preview are the ones Stash generated, so they work whatever the scene's format, and nothing records a play. A scene Stash has no previews for says so. The Challenge round's scene matches work the same way.
- In a scene bracket, a pick within 400 ms of the last one is ignored, so a double tap can't also pick in the next match.
- A finished bracket rates every performer or scene that played in it, first-round losers included, from where each finished, so a bracket sets ratings without the Challenge round or stars you give the champion. Its places are spread over what Cherry Pick expects you to think of your library, so its finishing order is laid over your own ratings: in a 16-place bracket drawn from your whole library the champion gets about the rating of your top sixteenth and the last place about your bottom sixteenth, and a bracket of one performer's scenes sits where those scenes sit in your library. With fewer than ten ratings of your own it uses Your score's spread for scenes, or one to five stars. These ratings are provisional, so a later bracket can correct them, and none goes above half a star under a rated performer or scene that beat it. It used to rate only the champion, finalist, semifinalists and quarterfinalists, and only once the Challenge round or your stars had placed the champion.
- The Challenge round is optional, behind Test the champion. Where it stops sets the champion's rating as before, and the rest move by the same amount, so the order holds. Rate them myself sets the champion's stars by hand and moves the rest the same way. The champion screen no longer says closing would set no ratings.
- Bracket's tooltip on more than 16 scenes reads "Bracket 16 of the 60 scenes in this list, from likely best to likely worst", and the same on a performer's scenes. It called them your top 16, and a bracket spreads its 16 places over the whole range of what Cherry Pick expects you to think of them.

Tested beside Ascension 1.4.1, HotOrNot 1.0.0-c4106bf, Stash Curator 0.39.1, Xenith 3.2.0 and Restash 0.3.0-55c1cb2.

## 0.1.3

- Brackets play the performers and scenes you haven't rated. People rate their favorites, so the rated ones won their way to nearly every final; they now play only when there aren't enough unrated ones to fill a bracket. Performers and scenes from your last three brackets of the same kind and gender sit out while others can take their places.
- The Challenge round: after the final, a champion with no rating of yours meets up to three performers or scenes you have rated, lowest rated first, until one beats it. Where it stops sets the champion's rating in Apply, and the finalist and semifinalists step down from it. A champion that beats every one gets a trophy on its performer card, "beat your favorites" in its For you line and a mark in the Hall of Fame. Rate them myself skips it.
- A loss to a rated performer or scene no longer sets a rating on its own. A first-round loser to your 5★ favorite was offered 4.5★.
- Scene brackets work the same way: scenes you have rated sit out while four unrated ones can play, so "Bracket her scenes" plays the ones you haven't rated and her rated ones wait for the champion. A champion meets the rated ones from its own list first.
- Apply bracket ratings automatically, a new switch under Settings > Plugins: closing a bracket's champion screen sets its ratings, and Cherry Pick's page keeps each batch with Undo. While nothing places the champion yet, the screen says closing would set none. It starts on, and off while Ascension, HotOrNot, Xenith or Restash's mirror writes your ratings, and follows those plugins until you set it yourself.

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
