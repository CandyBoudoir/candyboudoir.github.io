// The plugin's manifest settings: what Stash's Settings › Plugins renders and
// saves. Keep in step with src/CherryPick.yml (a unit test checks).
// Stash stores nothing for a setting the user never touched, so `def` is what
// a missing value means.
export const MANIFEST_SETTINGS = [
  { key: 'showForYou', type: 'BOOLEAN', def: true },
  { key: 'showFollowRows', type: 'BOOLEAN', def: true },
  { key: 'showHallOfFame', type: 'BOOLEAN', def: true },
  { key: 'showMoreLikeThis', type: 'BOOLEAN', def: true },
  { key: 'outOfLibrary', type: 'BOOLEAN', def: true },
  { key: 'badges', type: 'BOOLEAN', def: true },
  { key: 'sceneLine', type: 'BOOLEAN', def: true },
  { key: 'medals', type: 'BOOLEAN', def: true },
  { key: 'performerLine', type: 'BOOLEAN', def: true },
  { key: 'relativeBadges', type: 'BOOLEAN', def: false },
  { key: 'excludedTags', type: 'STRING', def: '' },
  { key: 'learnFromMatches', type: 'BOOLEAN', def: false },
]
export const SETTING_KEYS = MANIFEST_SETTINGS.map((s) => s.key)
export const SETTING_DEFAULTS = Object.fromEntries(
  MANIFEST_SETTINGS.map((s) => [s.key, s.def]),
)

// Stash keeps a plugin's settings in a map, so Settings › Plugins lists them
// in no fixed order; Cherry Pick sorts its own into the manifest's.
export function inManifestOrder(settings) {
  const rank = new Map(SETTING_KEYS.map((k, i) => [k, i]))
  return [...settings].sort(
    (a, b) => (rank.get(a.name) ?? 99) - (rank.get(b.name) ?? 99),
  )
}
