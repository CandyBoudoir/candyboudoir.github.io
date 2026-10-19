# Changelog

## 0.1.0

First release, for Stash v0.31.1.

- A page of what your favourite studios released in the last 48 hours, each linked to the studio's own page to buy it, from Stash's menu. Each release stays for 48 hours more, and releases you already have never show.
- Studios linked to ThePornDB come from ThePornDB, the rest from your other stash-boxes in one request per stash-box.
- Stash's scene cards with ThePornDB's landscape covers and each release's description, and Stash's pagination and page sizes.
- Filters for studios, and for performers and tags with and without, kept in the page's address with the page. Performers and tags carry your own names, matched by StashID, then by name or alias.
- Check for new releases runs with Stash's own Python and its standard library. The page starts it when its catalog is a day old and adds what each studio brings at the end of the list. It asks one request at a time, a few seconds after each answer, asks quiet studios once a week, and stops for the day at a 429, a server error or a Cloudflare challenge.
- The catalog stays in the plugin's folder across updates. Remove the catalog deletes it.
