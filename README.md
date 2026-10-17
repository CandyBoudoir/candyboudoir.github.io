# CandyBoudoir plugins for Stash

Plugins for [Stash](https://github.com/stashapp/stash), the self-hosted media organizer, published as one plugin source. Add the source once and every CandyBoudoir plugin appears under Available Plugins, including ones released later.

| Plugin                             | What it does                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Juicy](plugins/juicy/)            | A pink, playful theme: glossy candy stickers, gold hearts for ratings, a gum-bubble loader and a little cheek in the wording.                    |
| [Leather](plugins/leather/)        | A black leather theme: saddle stitching, nickel studs for ratings, a collar for favourites and a strict voice in the wording.                    |
| [Screentone](plugins/screentone/)  | A black-and-white manga page in one crimson-pink: inked stars for ratings, speech-bubble toasts, a pounding heart and a tsundere voice.          |
| [Cherry Pick](plugins/cherrypick/) | Learns what you like from your ratings and plays: a For you row, Your score on unrated scenes, More like this, and performer and scene brackets. |

Each theme restyles all of Stash, so enable one theme at a time. Cherry Pick works with any of them, or none.

## Install

1. In Stash, open Settings > Plugins > Available Plugins and click Add source.
2. Fill in the source:
   - Name: `CandyBoudoir`
   - Source URL: `https://candyboudoir.github.io/index.yml`
   - Local path: `candyboudoir`
3. Expand the CandyBoudoir source, tick the plugins you want and click Install.

If you run a Stash develop build, use `https://candyboudoir.github.io/develop/index.yml` as the source URL instead. It carries fixes for upcoming Stash changes before they reach the stable channel, and plugins that have no stable release yet. Add one of the two sources, never both: they carry the same plugins.

Stash lists new versions under Settings > Plugins > Installed Plugins when you click Check for updates. The [site](https://candyboudoir.github.io/) lists every plugin with its current version.

## Made with AI

These plugins are built with Claude, Anthropic's AI coding assistant, which writes most of the code under the author's direction. The author sets the design, reviews the changes and tests each release on a real Stash library. Commits that Claude helped write carry a `Co-Authored-By: Claude` line.

## Development

Requires Node 22.12 or newer and pnpm.

```bash
pnpm install
pnpm build                # dist/site: each plugin's folder and zip, the source index.yml and the site's pages
pnpm check                # prettier, eslint, stylelint
pnpm deploy:local juicy   # build, copy the named plugins into a Stash plugins folder over SSH and reload plugins
pnpm smoke                # after deploy:local cherrypick: a headless check of Cherry Pick on that Stash
```

`deploy:local` reads `STASH_URL`, `STASH_SSH_HOST`, `STASH_PLUGINS_DIR` (the folder holding the installed plugins, such as `/root/.stash/plugins/candyboudoir`) and, when Stash has a login, `STASH_API_KEY_FILE` from the environment. A gitignored `.envrc` is a good home for them.

`pnpm smoke` (`plugins/cherrypick/tests/smoke.mjs`) opens that Stash in headless Chromium and checks that the deployed files hash the same as `dist/site/CherryPick` (over `STASH_SSH_HOST`), that the navbar cherries and For you show on the front page, the bracket controls on the Scenes and Performers lists, the plugin page across a reload and the matches switch in Settings › Plugins, and that More like this on five scene pages at 1440 and 390 wide causes no sideways scroll, keeps its arrows on screen and, below 1200 wide, starts below the scene's tabs. It reads the same variables as `deploy:local`, prints statuses and counts only (nothing from the library, so its output is safe to share), and exits non-zero on a failed check or any page error. CI never runs it, since it needs your own Stash and its library.

Each plugin lives in `plugins/<name>/`: a `plugin.mjs` that tells the shared build (`scripts/build.mjs`) what goes into its plugin folder, its `CHANGELOG.md` and README, and its compatibility tests in `tests/`. `tests/stash/` is the Stash test harness the plugins share.

### Compatibility tests

The Compatibility workflow installs the plugins on each Stash version listed in `tests/stash-versions.json` and on the latest Stash develop build, every night and on every change. It checks that Stash still renders the elements each plugin depends on and compares screenshots with baselines from the newest listed version. To run it against a local Stash:

```bash
pnpm build
tests/stash/stash.sh v0.31.1 stash-work        # or develop
tests/stash/media.sh stash-work/library
WORK=stash-work node tests/stash/prepare.mjs   # PLUGINS=<id>,<id> picks the plugins, every plugin in the source by default
pnpm test:compat contract
```

`prepare.mjs` installs every plugin into the one Stash, and two themes enabled together would each see the other's CSS. Each plugin's spec files therefore start with `usePlugins` (`tests/stash/helpers.mjs`), which enables that plugin and disables the others; the shared pages, stash-box flows and screenshot helpers live in the same file.

`prepare.mjs` also points Stash at a mock stash-box (`tests/stash/stashbox.mjs`) that Playwright starts with the tests, so the Tagger, scrape dialogs and StashID links are checked against invented scenes, performers and studios with no stash-box account.

The specs run in Chromium; `BROWSER=firefox` or `BROWSER=webkit` runs them in another engine, and the workflow has a leg for each that runs Cherry Pick's specs.

Cherry Pick is also tested beside other authors' plugins it works alongside, each pinned in `tests/stash/companions.mjs` and installed by `COMPANIONS=<name>` (prepare.mjs and the specs both read it); the workflow has a leg for each. Stash installs each from a copy of its pinned zip that `tests/stash/companion-zips.mjs` fetches once per pin and keeps under `node_modules/.cache/companion-zips` (the workflow caches it on the zip's sha256), so test runs add nothing to the download counts on other authors' releases. The rule: every pin is that plugin's latest release, and Cherry Pick says which versions it was tested beside, in the Tested with table of its README and in each release's CHANGELOG section (`testedBeside()` in `companions.mjs` writes the sentence). `node tests/stash/tested-with.mjs` checks the README on every change, and while Cherry Pick's version has no release tag it also fails until every pin is its plugin's latest and that version's CHANGELOG section names them; CI runs it, and `scripts/release.mjs` refuses a release whose notes lack the sentence. The nightly run opens a "Test Cherry Pick beside <plugin> <version>" issue when one of them releases. To move a pin: read the release's changes against `plugins/cherrypick/docs/stash-seams.md`, pin its zip and sha256, run its leg, then update the README table and, if a release is pending, its CHANGELOG sentence.

Cherry Pick also has a walk through every feature on a library the size of a real one, which CI does not run. `plugins/cherrypick/tests/scale/library.mjs` seeds an invented library into its own throwaway Stash (`seed rater --scenes 25000 --performers 10000 --db <work>/config/stash-go.sqlite --summary <work>/summary.json`; the profiles are `rater`, `once`, `light` and `none`), and `STASH_URL=<that Stash> SCALE_SUMMARY=<work>/summary.json pnpm exec playwright test plugins/cherrypick/tests/scale` plays it from a first visit to Remove Cherry Pick data, writing timings to `SCALE_OUT`.

### Branches and releases

`main` is the trunk and feeds the develop channel. `prod` is the release branch. Every push to either publishes the site to GitHub Pages and checks the live files against the build.

Each plugin releases on its own. When `prod` carries a plugin version with no `<name>-vX.Y.Z` tag yet, the Publish workflow tags it and publishes a GitHub Release from that version's section in the plugin's `CHANGELOG.md`. The stable channel builds each plugin from its latest tag, so a plugin's changes reach it only with a version bump. A manual run of the Publish workflow can pin a plugin to an older tag to roll it back. Plugin zips are reproducible, so the release asset and the zip the build makes share one sha256. The stable channel and Juicy's own source point Stash at each plugin's release asset, and the build stops if the asset hashes differently, so each release's download count reads as installs and updates of that version. The develop channel serves its zips from Pages.

## License

MIT, except Cherry Pick, which is AGPL-3.0 (`plugins/cherrypick/LICENSE`). Juicy bundles Fredoka, Leather bundles Grenze Gotisch and Oswald, and Screentone bundles Dela Gothic One, Caveat Brush and Zen Kaku Gothic New, under the SIL Open Font License 1.1 (each plugin's `assets/fonts` folder holds the license).
