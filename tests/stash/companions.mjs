// Other authors' plugins the compatibility tests can install next to these,
// to check that both keep working side by side. COMPANIONS names them
// (comma separated, such as COMPANIONS=ascension): prepare.mjs installs
// them from a package source of its own, the way users install plugins,
// and usePlugins leaves them enabled. Each is pinned to one release: its zip,
// which Stash checks against sha256 as it installs it, at a fixed commit when
// the author keeps the zip in git.
const CURATOR_RELEASE =
  'https://github.com/mrx-31415/stash-curator/releases/download/v0.36.0'
const CURATOR_ZIPS = {
  'linux-x64': [
    'stash-curator-linux-amd64.zip',
    '4e997b78d325d909ba1b01c040147ff0dc52b94e5361ebcdd864abf6d787c1c5',
  ],
  'darwin-arm64': [
    'stash-curator-darwin-arm64.zip',
    '1d54e6cd42c3e8bbb38abe6d50ad5efb4980c270b29d3ada9f23fdcbd019334c',
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
  },
  // Stash Curator 0.36.0, local recommendations that score scenes and
  // performers on Stash's own cards, from
  // https://github.com/mrx-31415/stash-curator (AGPL-3.0). Its zip carries a
  // compiled backend, one zip per platform: linux-amd64 in CI, darwin-arm64
  // for a local run on a Mac. Both are the builds attached to the v0.36.0
  // release, which later releases leave in place; its GitHub Pages index
  // serves only the newest. Its manifest runs `python` (a launcher for the
  // backend), so Stash needs one on its PATH: where there is only python3,
  // link it as python.
  curator: {
    package: {
      id: 'stash-curator',
      name: 'Stash Curator',
      version: '0.36.0',
      date: '2026-10-14 18:50:51',
      ...curatorZip(),
    },
    enable: ['stash-curator'],
    disable: [],
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
  },
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

// The package source index.yml listing the companions
export const companionIndex = () =>
  companions()
    .map(({ package: p }) =>
      [
        `- id: ${p.id}`,
        `  name: ${p.name}`,
        `  version: ${p.version}`,
        `  date: "${p.date}"`,
        `  path: ${p.path}`,
        `  sha256: ${p.sha256}`,
      ].join('\n'),
    )
    .join('\n') + '\n'
