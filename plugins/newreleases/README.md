# New Releases

The newest releases from the studios you favourite in [Stash](https://github.com/stashapp/stash), the self-hosted media organizer, on one page you can filter by studio, performer and tag. Each release links to the studio's own page, where you can buy it. Studios linked to ThePornDB come from ThePornDB, which lists clip-site releases the day they come out, and the rest from your other stash-boxes, such as StashDB.

New Releases is still being built. It is in this repository for testing and is not in the CandyBoudoir plugin source yet.

## What you need

- Stash v0.31.1 or later.
- Python 3, which Stash runs the plugin's check with. Stash's Docker image includes it. Elsewhere Stash uses the Python path in Settings > System, or `python3` or `python` on its path. The check uses Python's standard library only, so there is nothing to install with pip.
- A stash-box with your API key in Settings > Metadata Providers: ThePornDB (`https://theporndb.net/graphql`), StashDB or another one.
- Favourite studios linked to that stash-box. The studio Tagger (Studios, then the Tagger view) links them.

## The page

New Releases adds an entry to Stash's menu, after Tags, and its page lives at `/plugins/newreleases`. Releases show newest first as Stash's scene cards: the cover, the studio, the length, the date, the performers and up to six tags. The cover and the title open the release on the studio's page in a new tab.

A release you already have carries an In your library badge that opens your scene. It counts as yours when a scene in your library has its stash-box StashID, or has its address and belongs to one of your favourite studios. Hide what I have leaves those out.

The filters pick studios, performers, tags and a date window. A release shows when it is from any of the studios you pick, has any of the performers and all of the tags, and has none of the performers or tags you leave out: each name appears twice in its list, under With and Without. A performer or tag on a card adds itself to the filters when you click it. The filters live in the page's address, so a filtered page can be bookmarked.

Performers and tags carry your names for them where you have them. New Releases matches each one by its StashID on that stash-box, then by its name or one of its aliases, ignoring case, accents and punctuation. The rest keep the stash-box's name.

Cards show no trailer. Stash plays video only from its own address, and plugins cannot change that, so the trailer plays on the studio's page.

## The check

A task, Check for new releases, asks the stash-boxes for each favourite studio's newest releases and keeps them. The page starts it when its catalog is a day old or when you have favourited a studio since the last check, shows what it has meanwhile, and fills in as each studio comes in. The check appears in Stash's job list, and Settings > Tasks can start it too.

The check goes slowly and asks as little as it can:

- One request at a time, three seconds apart, or further apart when Stash has a request limit set for that stash-box.
- ThePornDB gets two requests the first time it is asked about a studio, one for its numeric id and one for its newest 25 releases, and one a day after that, with the same address for the same studio on every install. Another stash-box gets one request a day for all of your studios linked to it, for their newest 100 releases.
- A studio whose newest release is more than 90 days old is asked about once a week.
- A stash-box that answers too many requests (429), a server error, a Cloudflare challenge or nothing at all is left alone until the next day. The check never retries.
- Every request says it comes from New Releases, with its version and this page's address, and carries your own key.

A studio linked to both ThePornDB and another stash-box comes from ThePornDB, since StashDB often lists clip-site releases weeks or months later. The page lists favourite studios with no stash-box link, with a pointer to the studio Tagger, and says when a stash-box has no key, refused it, or asked New Releases to stop.

## Privacy

The check sends requests only to the stash-boxes you set up in Stash, with your own key, asking about your favourite studios. Covers load in your browser from ThePornDB's or the stash-box's image servers, and a card opens the studio's own site. New Releases removes tracking and affiliate parameters from every link and adds none of its own. It reads Stash through its GraphQL API and never changes your library.

## The catalog

The check keeps what it finds in `catalog/catalog.json`, in the plugin's own folder, and the page reads it from there. Updating the plugin keeps it, because Stash replaces only the files the plugin came with. Uninstalling the plugin leaves the folder behind, so run Remove the catalog in Settings > Tasks first.

## Themes

The page uses Stash's own markup: its scene cards, list toolbar, selects, badges and loading indicator. Each CandyBoudoir theme restyles it the way it restyles Stash, with its own loader while the page loads.
