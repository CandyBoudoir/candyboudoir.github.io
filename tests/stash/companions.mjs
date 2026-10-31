import { access } from 'node:fs/promises'

// Other authors' plugins the compatibility tests can install next to these,
// to check that both keep working side by side. COMPANIONS names them
// (comma separated, such as COMPANIONS=ascension): prepare.mjs installs
// them from a package source of its own, the way users install plugins,
// and usePlugins leaves them enabled. Each is pinned to one release: its zip,
// which Stash checks against sha256 as it installs it, at a fixed commit when
// the author keeps the zip in git. The source serves a copy of each zip
// fetched once per pin (companion-zips.mjs), never the author's URL, so test
// runs leave release download counts alone. The pin is always the author's
// latest release: `latest` says where to look, and tested-with.mjs holds
// back a Cherry Pick release while a newer one is out.
const CURATOR_RELEASE =
  'https://github.com/mrx-31415/stash-curator/releases/download/v0.49.0'
const CURATOR_ZIPS = {
  'linux-x64': [
    'stash-curator-linux-amd64.zip',
    '6b791d2c577dd566892dfa5a988c2ecf7324193805a7c5c7f41f4445c3ab7367',
  ],
  'darwin-arm64': [
    'stash-curator-darwin-arm64.zip',
    'ffb408c6feb045fcd634a437f3a5737bb0ddafec14aad3d1225114db07aff890',
  ],
}
// Stash Curator's zip for the machine Stash runs on, linux-amd64 by default
function curatorZip() {
  const [file, sha256] =
    CURATOR_ZIPS[`${process.platform}-${process.arch}`] ??
    CURATOR_ZIPS['linux-x64']
  return { path: `${CURATOR_RELEASE}/${file}`, sha256 }
}

export const COMPANIONS = {
  // Ascension 1.4.1, the Elo ranking plugin (a fork of HotOrNot) from
  // https://github.com/Servbot91/Sakotos-Stash-Repo
  ascension: {
    package: {
      id: 'Ascension',
      name: 'Ascension',
      version: '1.4.1',
      date: '2026-10-15 21:16:32',
      path: 'https://github.com/Servbot91/Sakotos-Stash-Repo/raw/5d6f5b3c78330cf9d4fb97795916d45da48d7d66/plugins/Ascension/plugins/Ascension.zip',
      sha256:
        'efe00abc852f62c8e4001da555821aea69d2496a018ab68b25cc235562782f17',
    },
    // Stash plugin ids (manifest file names). The zip holds the release
    // build and a beta that must not run beside it.
    enable: ['ascension'],
    disable: ['ascension-beta'],
    // The source index users add, whose sha256 changes with each release
    latest: {
      index:
        'https://raw.githubusercontent.com/Servbot91/Sakotos-Stash-Repo/main/plugins/manifest.yml',
    },
  },
  // HotOrNot 1.0.0, the Elo ranking plugin Ascension was forked from and
  // whose hotornot_stats field HotOrNotV2 and HotOrNot_V3 also write, from
  // https://github.com/lowgrade12/hot-or-not
  // (plugins/hotornot at c4106bf; the zip is the build GitHub Pages serves
  // from that commit, whose four files hash to the same git blobs). It has
  // the longest forum thread of the HotOrNot builds, and its author handed
  // the plugin over in March 2026 with no later release. Pages keeps no
  // history, so a republished zip fails the sha256 check instead of
  // changing what the leg tests.
  hotornot: {
    package: {
      id: 'hotornot',
      name: 'HotOrNot',
      version: '1.0.0-c4106bf',
      date: '2026-03-06 04:46:55',
      path: 'https://lowgrade12.github.io/hot-or-not/main/hotornot.zip',
      sha256:
        '1aedd8f9ed57bbbee8d8a5e483482359edd0d0458cb4add2a1a8e69aa08c2123',
    },
    enable: ['hotornot'],
    disable: [],
    latest: { index: 'https://lowgrade12.github.io/hot-or-not/main/index.yml' },
  },
  // Stash Curator 0.49.0, local recommendations that score scenes and
  // performers on Stash's own cards, from
  // https://github.com/mrx-31415/stash-curator (AGPL-3.0). Its zip carries a
  // compiled backend, one zip per platform: linux-amd64 in CI, darwin-arm64
  // for a local run on a Mac. Both are the builds attached to the v0.49.0
  // release, which later releases leave in place; its GitHub Pages index
  // serves only the newest. Its manifest runs `python` (a launcher for the
  // backend), so Stash needs one on its PATH: where there is only python3,
  // link it as python.
  curator: {
    package: {
      id: 'stash-curator',
      name: 'Stash Curator',
      version: '0.49.0',
      date: '2026-10-30 18:28:33',
      ...curatorZip(),
    },
    enable: ['stash-curator'],
    disable: [],
    latest: { release: 'mrx-31415/stash-curator' },
  },
  // Xenith 3.2.0, the Elo ranking plugin forked from Ascension 1.2.6, from
  // https://github.com/gq1869/stashapp-xenith (GPL-3.0). The zip is the one
  // attached to the v3.2.0 release; its GitHub Pages stable index lags
  // behind the releases. Its stable and canary builds share the id xenith.
  xenith: {
    package: {
      id: 'xenith',
      name: 'Xenith',
      version: '3.2.0',
      date: '2026-10-09 22:27:05',
      path: 'https://github.com/gq1869/stashapp-xenith/releases/download/v3.2.0/xenith.zip',
      sha256:
        '581af60e1461662cb8a3a20d87ca8a3131c55a24d8b7a95b7e2cbab79140fbba',
    },
    enable: ['xenith'],
    disable: [],
    latest: { release: 'gq1869/stashapp-xenith' },
  },
  // Restash 0.3.0, which scores scenes and performers for freshness into
  // custom fields and can mirror that score to rating100, from
  // https://github.com/Espionage9248/Restash (MIT). Its GitHub Pages source
  // is the only build it publishes: the zip holds `restash/` at commit
  // 55c1cb2, the same files as the v0.3.0 tag. Pages keeps no history and
  // rebuilds the zip on every push to main, so a republished zip fails the
  // sha256 check instead of changing what the leg tests. Its backend runs on
  // `python` and needs stashapp-tools (the stashapi package).
  restash: {
    package: {
      id: 'restash',
      name: 'Restash',
      version: '0.3.0-55c1cb2',
      date: '2026-06-15 08:04:38',
      path: 'https://espionage9248.github.io/Restash/restash.zip',
      sha256:
        '8aa124d99bcb1b2df1a516f72f715fe1e57880d8ee0e660b8e9af7b6fba7b3e8',
    },
    enable: ['restash'],
    disable: [],
    latest: { index: 'https://espionage9248.github.io/Restash/index.yml' },
  },
  // Refract 1.24.3, the liquid-glass theme with the busiest theme topic on
  // the forum, from https://github.com/ordureconnoisseur/stash-refract
  // (AGPL-3.0). Its GitHub Pages source is the only build it publishes:
  // the zip holds the theme at commit 458b135 of ordureconnoisseur/plugins.
  // Pages keeps no history and rebuilds the zip on every push, so a
  // republished zip fails the sha256 check instead of changing what the leg
  // tests. From 1200px wide it lays the scene page's .row out as a grid
  // locked to the window's height, which is why it is a companion.
  refract: {
    package: {
      id: 'refract',
      name: 'Refract',
      version: '1.24.3-458b135',
      date: '2026-09-06 09:04:46',
      path: 'https://ordureconnoisseur.github.io/plugins/main/refract.zip',
      sha256:
        '5071d1aaf7052f1c6f82a346d27ccad7eddbde978402516639db33bbdb7cfd47',
    },
    enable: ['refract'],
    disable: [],
    latest: {
      index: 'https://ordureconnoisseur.github.io/plugins/main/index.yml',
    },
  },
}

// Other authors' plugins that themes here restyle. prepare.mjs puts each of
// these into every test Stash, switched off, and the specs of the themes
// that restyle it switch it on (usePlugins) to check and shoot the theme's
// look for it; each such theme keeps tests/<key>-unmatched-baseline.txt. Each is pinned to the files of one release at its commit in
// the author's repository, by sha256: an author's Pages source keeps only
// its newest zip, and a test Stash that cannot get the pinned files fails
// every plugin's specs, not one leg's. tested-with.mjs holds back a release
// of a theme that restyles one while a newer release of it is out, and with
// --issues opens an issue for it; pin-restyled.mjs moves a pin to the latest
// release.
const INSIGHTS_COMMIT = 'c660e7dc2677900b63f27636d81c847f7b3f14bc'
const PERFORMERS_TOOLKIT_COMMIT = '0d58f7b7d5f2a209336065f20cf863b94aac3f15'
export const RESTYLED = {
  // Insights 2.14.1, a stats dashboard on Stash's Stats page, from
  // https://gitlab.com/allisless0/stash-plugins (MIT): its plugin folder at
  // the 2.14.1 commit, the same files as the zip its GitLab Pages source
  // served for that release.
  insights: {
    id: 'Insights',
    name: 'Insights',
    version: '2.14.1',
    commit: INSIGHTS_COMMIT,
    base: `https://gitlab.com/allisless0/stash-plugins/-/raw/${INSIGHTS_COMMIT}/plugins/Insights`,
    files: {
      'Insights.css':
        '959eab447780ef03db2c99cbf41e9fd0d86e424744e54715da493b93b9eabc6d',
      'Insights.js':
        'b93e2a6441cd255866315fe5a4721ed551bca6b72ea727f6fb1a6d8861bcccd5',
      'Insights.yml':
        'd2838617525e824fcd7de9708df8dc32d5046cb8243f8b856c27967084e552f1',
      'README.md':
        'fa8a53abc408511411b6680b3cb5e580417569467b6baa965ee66f296dc80a3e',
    },
    latest: {
      index: 'https://allisless0.gitlab.io/stash-plugins/main/index.yml',
    },
  },
  // Performers Toolkit 0.23.1, a toolkit page at /performerstoolkit and a
  // strip and two tabs on performer pages, from the same repository and
  // in the same Flexoki look as Insights. Its scans and saves run in a
  // Python backend (standard library only), which the specs never start.
  performerstoolkit: {
    id: 'PerformersToolkit',
    name: 'Performers Toolkit',
    version: '0.23.1',
    commit: PERFORMERS_TOOLKIT_COMMIT,
    base: `https://gitlab.com/allisless0/stash-plugins/-/raw/${PERFORMERS_TOOLKIT_COMMIT}/plugins/PerformersToolkit`,
    files: {
      'PerformersToolkit-matte.js':
        'fdd022c5b4653b6ade3ce88f57198abcc6d344769304164205247925a63f76f6',
      'PerformersToolkit.js':
        '889a6c1be93a716e2a0e6248ecab1fc297a2c05cac2f75839fa1308383dce5bb',
      'PerformersToolkit.py':
        'b07addb4c7467f3fe036284ac2c05da2818c860de56004f64dda8302dc39140f',
      'PerformersToolkit.yml':
        'd29730247938761250812801298dc0577f8dc13071c79981cf1f9ac111e55316',
      'README.md':
        'bcae2fa8af169a9cad24ba85cb2ad26379d2eb7e98e9990fc00a5c5b9c393412',
    },
    latest: {
      index: 'https://allisless0.gitlab.io/stash-plugins/main/index.yml',
    },
  },
}

// Other authors' plugins that plugins here extend through an API of theirs.
// Like the restyled plugins, prepare.mjs puts each into every test Stash,
// switched off, and the specs of the plugins that extend it (extendedBy)
// switch it on (usePlugins). Each is pinned to a commit in the author's git
// repository and its plugin folder there: companion-zips.mjs fetches that
// commit alone and zips the folder with the build's own zip code
// (scripts/site.mjs), and prepare.mjs serves the zip from its package source
// under the zip's sha256. The commit pins the content, where a zip pinned by
// sha256 would last hours: the author's Pages source keeps only its newest
// zip and republishes it with each change. `date` is the commit's (UTC),
// which stamps the zip's files. A release of a plugin that extends one names
// the pin and, since the author releases several times a day, needs it to
// have been the latest within the day (tested-with.mjs);
// `node tests/stash/pin-extended.mjs` moves a pin to the latest.
export const EXTENDED = {
  // Stash UI 3.115.1, a replacement interface for Stash that imports
  // assets/stashui.js from each enabled plugin, from
  // https://github.com/anonym88312/stash-pmv-plugins (MIT). Its GitHub Pages
  // source zips plugins/stashui as committed, so the folder at the commit
  // holds the files of the zip it served for that release. Its backend runs
  // on `python`, which the specs never start.
  stashui: {
    id: 'stashui',
    name: 'Stash UI',
    version: '3.115.1',
    repo: 'anonym88312/stash-pmv-plugins',
    commit: 'ed9c93a44ad4b3660783110e672ad0bf393da76a',
    folder: 'plugins/stashui',
    date: '2026-10-20 15:04:32',
    extendedBy: ['citypop-stashui', 'overclock-stashui'],
    // The source index users add, whose zip pin-extended.mjs checks
    latest: {
      index: 'https://anonym88312.github.io/stash-pmv-plugins/index.yml',
    },
  },
}

// The restyled plugins, keyed like the companions
export const restyled = () =>
  Object.entries(RESTYLED).map(([key, r]) => ({ key, ...r }))

// The extended plugins, keyed like the companions
export const extended = () =>
  Object.entries(EXTENDED).map(([key, e]) => ({ key, ...e }))

// The extended plugins a plugin of ours extends
export const extendedBy = (folder) =>
  extended().filter((e) => e.extendedBy.includes(folder))

// The restyled plugins a plugin of ours restyles: those it keeps an
// unmatched-class baseline for (plugins/<folder>/tests/<key>-unmatched-baseline.txt)
export async function restyledBy(folder) {
  const found = []
  for (const r of restyled()) {
    const baseline = new URL(
      `../../plugins/${folder}/tests/${r.key}-unmatched-baseline.txt`,
      import.meta.url,
    )
    if (
      await access(baseline).then(
        () => true,
        () => false,
      )
    )
      found.push(r)
  }
  return found
}

// The sentence each release of a theme that restyles them, or of a plugin
// that extends them, carries in its CHANGELOG section, naming the versions
// its specs ran beside
export function restyledBeside(list) {
  const names = list.map((r) => `${r.name} ${r.version}`)
  const named =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
      : names[0]
  return `Tested beside ${named}.`
}

export function companions() {
  return (process.env.COMPANIONS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((key) => {
      if (!COMPANIONS[key]) throw new Error(`Unknown companion plugin ${key}`)
      return { key, ...COMPANIONS[key] }
    })
}

// The companions' plugin ids, which stay enabled beside the plugin under test
export const companionPluginIds = () => companions().flatMap((c) => c.enable)

// The package source index.yml listing the companions and any other
// packages given (id, name, version, date, sha256), whose zips are served
// from base under their sha256
export const companionIndex = (base, others = []) =>
  [...companions().map((c) => c.package), ...others]
    .map((p) =>
      [
        `- id: ${p.id}`,
        `  name: ${p.name}`,
        `  version: ${p.version}`,
        `  date: "${p.date}"`,
        `  path: ${base}/${p.sha256}.zip`,
        `  sha256: ${p.sha256}`,
      ].join('\n'),
    )
    .join('\n') + '\n'

// The plugin whose contract specs the companion legs run
export const TESTED_PLUGIN = 'cherrypick'

// The sentence each Cherry Pick release's CHANGELOG section carries, naming
// the companion versions its specs ran beside
export function testedBeside() {
  const names = Object.values(COMPANIONS).map(
    (c) => `${c.package.name} ${c.package.version}`,
  )
  return `Tested beside ${names.slice(0, -1).join(', ')} and ${names.at(-1)}.`
}
