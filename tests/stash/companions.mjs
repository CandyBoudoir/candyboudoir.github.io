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
  'https://github.com/mrx-31415/stash-curator/releases/download/v0.40.4'
const CURATOR_ZIPS = {
  'linux-x64': [
    'stash-curator-linux-amd64.zip',
    'c6e110972cd1145a39d42c0063d21db47d0afd8b1235b9f4c836f0d0c426e2b3',
  ],
  'darwin-arm64': [
    'stash-curator-darwin-arm64.zip',
    '7d88f3af696a06127f41fbb4fb068af42c6bbafd3367eacc50c8e71eb2c0cdf8',
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
  // Stash Curator 0.40.4, local recommendations that score scenes and
  // performers on Stash's own cards, from
  // https://github.com/mrx-31415/stash-curator (AGPL-3.0). Its zip carries a
  // compiled backend, one zip per platform: linux-amd64 in CI, darwin-arm64
  // for a local run on a Mac. Both are the builds attached to the v0.40.4
  // release, which later releases leave in place; its GitHub Pages index
  // serves only the newest. Its manifest runs `python` (a launcher for the
  // backend), so Stash needs one on its PATH: where there is only python3,
  // link it as python.
  curator: {
    package: {
      id: 'stash-curator',
      name: 'Stash Curator',
      version: '0.40.4',
      date: '2026-10-18 10:53:26',
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
const INSIGHTS_COMMIT = '97171c133f1c7f5214a6d2950c51364b9a72787c'
const PERFORMERS_TOOLKIT_COMMIT = 'e357be13a5ccc771b9b5b9d7ff4596d16aeaa31f'
export const RESTYLED = {
  // Insights 2.11.0, a stats dashboard on Stash's Stats page, from
  // https://gitlab.com/allisless0/stash-plugins (MIT): its plugin folder at
  // the 2.11.0 commit, the same files as the zip its GitLab Pages source
  // served for that release.
  insights: {
    id: 'Insights',
    name: 'Insights',
    version: '2.11.0',
    commit: INSIGHTS_COMMIT,
    base: `https://gitlab.com/allisless0/stash-plugins/-/raw/${INSIGHTS_COMMIT}/plugins/Insights`,
    files: {
      'Insights.css':
        '959eab447780ef03db2c99cbf41e9fd0d86e424744e54715da493b93b9eabc6d',
      'Insights.js':
        'ac1218f967c8549009b074ea99c2465cb03b49de0f7023de4b43b76bbc1d5b76',
      'Insights.yml':
        '1684c6204f019144c308400d99bb464573327937cf3151a2067a3ac2019607f5',
      'README.md':
        '3c85d7bac6f1bc7314da60695a0e587de4da122431b1b68421bb6c5bccb330af',
    },
    latest: {
      index: 'https://allisless0.gitlab.io/stash-plugins/main/index.yml',
    },
  },
  // Performers Toolkit 0.4.2, a toolkit page at /performerstoolkit and a
  // strip and two tabs on performer pages, from the same repository and
  // in the same Flexoki look as Insights. Its scans and saves run in a
  // Python backend (standard library only), which the specs never start.
  performerstoolkit: {
    id: 'PerformersToolkit',
    name: 'Performers Toolkit',
    version: '0.4.2',
    commit: PERFORMERS_TOOLKIT_COMMIT,
    base: `https://gitlab.com/allisless0/stash-plugins/-/raw/${PERFORMERS_TOOLKIT_COMMIT}/plugins/PerformersToolkit`,
    files: {
      'PerformersToolkit.js':
        '28c305412ad4f8e5e22a00b3eb3e8db091034543e293d1f78449e632abaaa955',
      'PerformersToolkit.py':
        'b1346251b90392c8aadd95cbf5d0ff64f4faf9a01822fc791a86d6c9325ef930',
      'PerformersToolkit.yml':
        '8703d360e16a9f5464d0fd02f180952fef3f25b4fc1dd76dde6aee1fab72ff53',
      'README.md':
        '97fe8edec0bdbda3107e541d3144e534f13488ff5919681dc9ddcc0b85c720c4',
    },
    latest: {
      index: 'https://allisless0.gitlab.io/stash-plugins/main/index.yml',
    },
  },
}

// The restyled plugins, keyed like the companions
export const restyled = () =>
  Object.entries(RESTYLED).map(([key, r]) => ({ key, ...r }))

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

// The sentence each release of a theme that restyles them carries in its
// CHANGELOG section, naming the versions its specs ran beside
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

// The package source index.yml listing the companions, whose zips are served
// from base under their sha256
export const companionIndex = (base) =>
  companions()
    .map(({ package: p }) =>
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
