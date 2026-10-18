// Turns the imported bundle (data/concepts.json) into the compact index the
// plugin script carries, at build time:
//   concepts  [{ n: name, i: icon file or null, x: true when a nude version exists }]
//   stashdb   { StashDB tag ID: concept index, or -1 for "no icon" }
//   names     { normalized name: concept index }
// Library names come first. StashDB names and aliases fill in after them, and
// a StashDB name that tags with different concepts share is left out, since
// it cannot say which icon is meant.
import { normalize } from './src/match.js'

export function buildIndex(bundle) {
  if (bundle.format !== 1)
    throw new Error(`Unknown bundle format ${bundle.format}`)
  const concepts = bundle.concepts.map((c) => {
    const entry = { n: c.name, i: c.icon }
    if (c.nude) entry.x = true
    return entry
  })

  const stashdb = {}
  for (const id of bundle.stashdb_none) stashdb[id] = -1
  bundle.concepts.forEach((c, i) => {
    for (const s of c.stashdb) stashdb[s.id] = i
  })

  const names = {}
  bundle.concepts.forEach((c, i) => {
    for (const tag of c.tags) {
      const key = normalize(tag)
      if (!key) continue
      if (names[key] !== undefined && names[key] !== i)
        throw new Error(`Library names ${tag} and another share the key ${key}`)
      names[key] = i
    }
  })

  const shared = new Map()
  bundle.concepts.forEach((c, i) => {
    for (const s of c.stashdb)
      for (const n of [s.name, ...s.aliases]) {
        const key = normalize(n)
        if (!key || names[key] !== undefined) continue
        if (!shared.has(key)) shared.set(key, new Set())
        shared.get(key).add(i)
      }
  })
  const ambiguous = []
  for (const [key, set] of [...shared].sort(([a], [b]) => (a < b ? -1 : 1)))
    if (set.size === 1) names[key] = [...set][0]
    else ambiguous.push(key)

  return { concepts, stashdb, names, keywords: bundle.keywords, ambiguous }
}
