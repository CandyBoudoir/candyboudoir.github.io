// Other authors' plugins the compatibility tests can install next to these,
// to check that both keep working side by side. COMPANIONS names them
// (comma separated, such as COMPANIONS=ascension): prepare.mjs installs
// them from a package source of its own, the way users install plugins,
// and usePlugins leaves them enabled. Each is pinned to one release: its zip,
// which Stash checks against sha256 as it installs it, at a fixed commit when
// the author keeps the zip in git.
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
  // HotOrNot 1.0.0, the Elo ranking plugin the Ascension, HotOrNotV2 and
  // HotOrNot_V3 forks start from, from https://github.com/lowgrade12/hot-or-not
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
