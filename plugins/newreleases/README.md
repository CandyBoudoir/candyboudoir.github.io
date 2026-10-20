# New Releases

What the studios you favourite in [Stash](https://github.com/stashapp/stash), the self-hosted media organizer, released in the last few days, on one page you can filter by studio, performer and tag, leaving out what you already have. Each release links to the studio's own page, where you can buy it. Studios linked to ThePornDB come from ThePornDB, which lists clip-site releases the day they come out, and the rest from your other stash-boxes, such as StashDB.

## Install

New Releases comes from the CandyBoudoir plugin source, which carries every CandyBoudoir plugin.

1. In Stash, open Settings > Plugins > Available Plugins and click Add source.
2. Fill in the source:
   - Name: `CandyBoudoir`
   - Source URL: `https://candyboudoir.github.io/index.yml`
   - Local path: `candyboudoir`
3. Expand the CandyBoudoir source, tick New Releases and click Install.
4. Open New Releases from Stash's menu. Its first visit starts the first check, and the page fills in as each studio comes in.

If you run a Stash develop build, use `https://candyboudoir.github.io/develop/index.yml` as the source URL instead. Add one of the two sources, never both: they carry the same plugins.

## What you need

- Stash v0.31.1 or later.
- Python 3, which Stash runs the plugin's check with. Stash's Docker image includes it. Elsewhere Stash uses the Python path in Settings > System, or `python3` or `python` on its path. The check uses Python's standard library only, so there is nothing to install with pip.
- A stash-box with your API key in Settings > Metadata Providers: ThePornDB (`https://theporndb.net/graphql`), StashDB or another one.
- Favourite studios linked to that stash-box. The studio Tagger (Studios, then the Tagger view) links them.

## The page

New Releases adds an entry to Stash's menu, after Tags, and its page lives at `/plugins/newreleases`. Releases show as Stash's scene cards: the cover, the studio, the length, the date, the performers, the description and up to six tags. The cover and the title open the release on the studio's page in a new tab. The page sorts and pages as Stash's lists do, with Stash's sort menu and direction button, Stash's pagination above and below the cards, and its page sizes, 40 to a page unless you pick another.

The sorts are Stash's scene sorts that a release has: Date, Duration, Performer Count, Random, Studio, Tag Count and Title. Found sorts by when a check first found each release, which orders releases within a day, since release dates carry no time. Date, newest first, is the default. Releases with no length, and those found before New Releases 0.2.0 kept the time, go last under Duration and Found in either direction. Random keeps its seed in the address, as Stash's lists do, and Reshuffle picks another.

A release its studio's latest check found carries a New badge until the next check of that studio. A studio's first check, such as after you favourite it, finds releases that may be days old, so they carry no badge.

Releases you already have never show. A release counts as yours when a scene in your library has its stash-box StashID, or has its address and belongs to one of your favourite studios.

The filters pick studios, performers and tags. A release shows when it is from any of the studios you pick, has any of the performers and all of the tags, and has none of the performers or tags you leave out: each name appears twice in its list, under With and Without. A performer or tag on a card adds itself to the filters when you click it. The filters, the sort and the page live in the page's address, as Stash's lists keep theirs, so a filtered page can be bookmarked. While a performer or tag menu is open, its names hold still as a check adds releases.

Performers and tags carry your names for them where you have them. New Releases matches each one by its StashID on that stash-box, then by its name or one of its aliases, ignoring case, accents and punctuation. The rest keep the stash-box's name.

Cards show no trailer. Stash plays video only from its own address, and plugins cannot change that, so the trailer plays on the studio's page.

## The check

A task, Check for new releases, asks the stash-boxes for each favourite studio's newest releases and keeps those dated within the last 48 hours. Each stays in the catalog for 48 hours more and leaves it once it is four days old, so the page holds what came out this week and nothing older. The page starts the check when its catalog is a day old or when you have favourited a studio since the last one, and shows what it has meanwhile. Releases the check finds while the page is open go to a Just in row above the list, newest first, in the row Stash's front page uses, and the filters apply to it too. The list keeps the releases and the order it opened with, and takes the new ones on your next visit. When the page opens with nothing to show, as on its first visit, the list takes each release as it arrives, in order. The check appears in Stash's job list, and Settings > Tasks can start it too.

The check goes slowly and asks as little as it can:

- One request at a time, each three seconds after the last answer, or further apart when Stash has a request limit set for that stash-box.
- ThePornDB gets two requests the first time it is asked about a studio, one for its numeric id and one for its newest 25 releases, and one a day after that, with the same address for the same studio on every install. Another stash-box gets one request a day for all of your studios linked to it, for their newest 100 releases.
- A studio whose newest release is more than 90 days old is asked about once a week.
- A stash-box that answers too many requests (429), a server error, a Cloudflare challenge or nothing at all is left alone until the next day. The check never retries.
- Every request says it comes from New Releases, with its version and this page's address, and carries your own key.

A studio linked to both ThePornDB and another stash-box comes from ThePornDB, since StashDB often lists clip-site releases weeks or months later, by when they are past the 48 hours. The page lists favourite studios with no stash-box link, with a pointer to the studio Tagger, and says when a stash-box has no key, refused it, or asked New Releases to stop.

## Privacy

The check sends requests only to the stash-boxes you set up in Stash, with your own key, asking about your favourite studios. Covers load in your browser from ThePornDB's or the stash-box's image servers, and a card opens the studio's own site. New Releases removes tracking and affiliate parameters from every link and adds none of its own. It reads Stash through its GraphQL API and never changes your library.

## The catalog

The check keeps what it finds in `catalog/catalog.json`, in the plugin's own folder, and the page reads it from there. An update that changes the catalog's shape keeps only ThePornDB's numeric ids for your studios, and the page asks for a check on its next visit. Updating the plugin keeps it, because Stash replaces only the files the plugin came with. Uninstalling the plugin leaves the folder behind, so run Remove the catalog in Settings > Tasks first.

## Themes

The page uses Stash's own markup: its scene cards, list toolbar, selects, sort menu, front-page row, badges and loading indicator. Each CandyBoudoir theme restyles it the way it restyles Stash, with its own loader while the page loads.
