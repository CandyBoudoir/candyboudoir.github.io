// Matching a library tag to a Tag Candy concept. Pure functions: the plugin
// script runs them inside Stash, and the unit tests and lookup.mjs run them in
// Node, so the build and the plugin always normalize a name the same way.

// StashDB's GraphQL endpoint, as Stash stores it on each StashID.
export const STASHDB = 'stashdb.org'

// The key a name matches by: lowercase, "&" read as "and", accents dropped,
// then letters and digits only. "Stockings & Hosiery" and "stockings and
// hosiery" share the key "stockingsandhosiery".
export function normalize(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
}

// Parses the Extra matches setting: `tag=concept` pairs separated by
// semicolons or new lines. Returns { pairs: Map(tag key -> concept index),
// unknown: [concept names the data does not hold] }.
export function parseExtraMatches(text, index) {
  const byConcept = new Map()
  index.concepts.forEach((c, i) => byConcept.set(normalize(c.n), i))
  const pairs = new Map()
  const unknown = []
  for (const part of String(text ?? '').split(/[;\n]/)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const tag = normalize(part.slice(0, eq))
    const concept = part.slice(eq + 1).trim()
    if (!tag || !concept) continue
    const i = byConcept.get(normalize(concept))
    if (i === undefined) unknown.push(concept)
    else pairs.set(tag, i)
  }
  return { pairs, unknown }
}

// Matches one tag ({ name, aliases, stash_ids }) and returns
// { concept, via }: concept is an index into index.concepts, or -1 when the
// tag's StashDB tag was reviewed as getting no icon, or null when nothing
// matched. via names the rule that decided it.
export function matchTag(tag, index, extra) {
  const name = normalize(tag.name)
  if (extra && extra.has(name))
    return { concept: extra.get(name), via: 'extra' }

  // A tag linked to a StashDB tag the data knows is decided by that link
  // alone: Stash copies StashDB's aliases onto the tags it creates, and
  // StashDB files some narrower terms as aliases of broader tags.
  for (const sid of tag.stash_ids ?? []) {
    if (!String(sid.endpoint).includes(STASHDB)) continue
    const i = index.stashdb[sid.stash_id]
    if (i !== undefined) return { concept: i, via: 'stashdb' }
  }

  if (name && index.names[name] !== undefined)
    return { concept: index.names[name], via: 'name' }
  for (const alias of tag.aliases ?? []) {
    const key = normalize(alias)
    if (key && index.names[key] !== undefined)
      return { concept: index.names[key], via: 'alias' }
  }
  return { concept: null, via: 'none' }
}
