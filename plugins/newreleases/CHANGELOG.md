# Changelog

## 0.2.2

- The page takes Stash's stash-boxes from the copy of Stash's configuration that Stash's own pages hold, and no longer sends a configuration query of its own on each visit. On Stash v0.30.0 to v0.31.1 a configuration query that meets a configuration write can freeze Stash until it restarts, so this lowers the risk of a freeze.

## 0.2.1

- Just in shows each release once. With more releases than Stash's slider shows at the window's width, the row looped, and the copies the slider makes to loop showed after the releases on a wide screen, so each release appeared twice. The row now ends at its last release.

## 0.2.0

- The page sorts as Stash's scene lists do, with Stash's sort menu and direction button: Date, Duration, Found, Performer Count, Random, Studio, Tag Count and Title. Date, newest first, is the default. Found sorts by when a check first found each release, which orders releases within a day, since release dates carry no time. Random keeps its seed in the address, and Reshuffle picks another. The sort lives in the address with the filters and the page.
- Releases a check finds while the page is open go to a Just in row above the list, newest first, in the row Stash's front page uses. The list keeps the releases and the order it opened with, and takes the new ones on your next visit. 0.1.0 added them at the end of the list, out of date order and out of sight on the last page of a long list. When the page opens with nothing to show, as on its first visit, the list takes each release as it arrives, in order.
- A New badge marks the releases a studio's latest check found, until the next check of that studio. Releases a studio's first check finds, such as after you favourite it, carry none.
- While a performer or tag menu is open, its names and counts hold still as a check adds releases.
- Releases a quick check found while the page was open show. When a check finished within a few seconds, the page read the catalog twice in a row and dropped its look-up of the scenes you have, so the new releases stayed hidden until the next visit.
- The check keeps, in the catalog it already has, when it first found each release and when it last asked each studio. Releases found before 0.2.0 have no time and go last under Found.

## 0.1.0

First release, for Stash v0.31.1.

- A page of what your favourite studios released in the last 48 hours, each linked to the studio's own page to buy it, from Stash's menu. Each release stays for 48 hours more, and releases you already have never show.
- Studios linked to ThePornDB come from ThePornDB, the rest from your other stash-boxes in one request per stash-box.
- Stash's scene cards with ThePornDB's landscape covers and each release's description, and Stash's pagination and page sizes.
- Filters for studios, and for performers and tags with and without, kept in the page's address with the page. Performers and tags carry your own names, matched by StashID, then by name or alias.
- Check for new releases runs with Stash's own Python and its standard library. The page starts it when its catalog is a day old and adds what each studio brings at the end of the list. It asks one request at a time, a few seconds after each answer, asks quiet studios once a week, and stops for the day at a 429, a server error or a Cloudflare challenge.
- The catalog stays in the plugin's folder across updates. Remove the catalog deletes it.
