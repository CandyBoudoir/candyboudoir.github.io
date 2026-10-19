# Changelog

## 0.1.0

First release, for Stash v0.31.1.

- A page of the newest releases from your favourite studios, each linked to the studio's own page to buy it, from Stash's menu.
- Studios linked to ThePornDB come from ThePornDB, the rest from your other stash-boxes in one request per stash-box.
- Filters for studios, performers, tags with and without, a date window and Hide what I have, kept in the page's address.
- Performers and tags carry your own names, matched by StashID, then by name or alias. Releases you already have carry an In your library badge.
- Check for new releases runs with Stash's own Python and its standard library. The page starts it when its catalog is a day old and fills in as it goes. It asks one request at a time, a few seconds apart, asks quiet studios once a week, and stops for the day at a 429, a server error or a Cloudflare challenge.
- The catalog stays in the plugin's folder across updates. Remove the catalog deletes it.
