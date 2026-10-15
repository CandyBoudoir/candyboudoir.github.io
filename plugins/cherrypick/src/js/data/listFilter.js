// Stash's list filters, as brackets read and write them. A list component
// (PerformerList, SceneList) gets the list's ListFilterModel in its props:
// `makeFilter()` gives the GraphQL criteria, `searchTerm` the search box and
// `criteria` the criterion objects, each with `criterionOption.type`,
// `modifier` and `value`. Brackets read three things from it: whether the
// list is filtered, the gender it filters on, and a short label for the pool.
//
// Links back into Stash's lists use Stash's own URL encoding
// (ListFilterModel.getEncodedParams in models/list-filter/filter.ts): one
// `c=` parameter per criterion, its JSON with { } turned into ( ) outside
// strings, then URL-encoded.

// Stash's gender criterion in GraphQL criteria: `value_list` (or the older
// single `value`) with a modifier. 'none' for "gender is null"; null when
// the list does not filter on exactly one gender.
export function listGender(criteria) {
  const g = criteria?.gender
  if (!g) return null
  if (g.modifier === 'IS_NULL') return 'none'
  if (g.modifier !== 'INCLUDES' && g.modifier !== 'EQUALS') return null
  const list = g.value_list?.length ? g.value_list : g.value ? [g.value] : []
  return list.length === 1 ? list[0] : null
}

const NAMES = {
  filter_favorites: 'Favorites',
  performer_favorite: 'Favorite performers',
  rating100: 'Rating',
  o_counter: 'O count',
  play_count: 'Play count',
  play_duration: 'Play duration',
  scene_count: 'Scene count',
  is_missing: 'Missing',
  has_markers: 'Has markers',
  organized: 'Organized',
  interactive: 'Interactive',
}
const SYMBOLS = {
  EQUALS: '=',
  NOT_EQUALS: '≠',
  GREATER_THAN: '>',
  LESS_THAN: '<',
  INCLUDES: '',
  INCLUDES_ALL: '',
}

const humanize = (type) =>
  NAMES[type] ||
  (type ? type[0].toUpperCase() + type.slice(1).replace(/_/g, ' ') : '')

// A criterion's short label, close to Stash's own filter tags without its
// translations: "Rooftop", "Bea Lark, Juno Marsh", "Rating > 80",
// "Not Snow", "No gender".
export function criterionLabel(c) {
  const type = c?.criterionOption?.type || ''
  const name = humanize(type)
  const mod = c?.modifier
  const v = c?.value
  const not = mod === 'EXCLUDES' || mod === 'NOT_EQUALS' ? 'Not ' : ''
  if (type === 'custom_fields')
    return (Array.isArray(v) ? v : [])
      .map((f) =>
        [f.field, SYMBOLS[f.modifier] ?? f.modifier, (f.value || []).join(', ')]
          .filter((x) => x !== '')
          .join(' '),
      )
      .join(', ')
  if (mod === 'IS_NULL') return `No ${name.toLowerCase()}`
  if (mod === 'NOT_NULL') return `Has ${name.toLowerCase()}`
  if (v && Array.isArray(v.items)) {
    const labels = v.items.map((i) => i.label).filter(Boolean)
    if (labels.length) return not + labels.join(', ')
  }
  if (Array.isArray(v) && v.length) return not + v.join(', ')
  if (typeof v === 'string' && v) {
    if (v === 'true') return name
    if (v === 'false') return `Not ${name.toLowerCase()}`
    return `${name}: ${v}`
  }
  if (v && typeof v === 'object' && v.value != null) {
    const range = /BETWEEN/.test(mod || '') && v.value2 != null
    const sym = SYMBOLS[mod] ?? ''
    return range
      ? `${name} ${not ? 'not ' : ''}${v.value} to ${v.value2}`
      : `${name} ${sym ? sym + ' ' : ''}${v.value}`
  }
  return name
}

/**
 * What brackets need from a list's filter.
 * @param {{ makeFilter: () => object, searchTerm?: string, criteria?: object[] }} filter
 *   Stash's ListFilterModel (or anything shaped like it)
 * @returns {{ key: string, criteria: object, q: string, active: boolean,
 *   gender: string|null, label: string, fullLabel: string, count: number }}
 *   label leaves the gender out (the bracket names its gender already);
 *   fullLabel keeps it
 */
export function describeFilter(filter) {
  const criteria = filter.makeFilter() || {}
  const q = filter.searchTerm || ''
  const parts = (filter.criteria || []).map((c) => ({
    type: c?.criterionOption?.type,
    label: criterionLabel(c),
  }))
  const labels = (withGender) =>
    [
      ...parts
        .filter((p) => p.label && (withGender || p.type !== 'gender'))
        .map((p) => p.label),
      q ? `"${q}"` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  return {
    key: JSON.stringify([criteria, q]),
    criteria,
    q,
    active: parts.length > 0 || !!q,
    count: parts.length,
    gender: listGender(criteria),
    label: labels(false),
    fullLabel: labels(true),
  }
}

// ------------------------------------------------------------ Stash list URLs

// { } to ( ) outside JSON strings, as Stash's translateJSON does
function parens(json) {
  let inString = false
  let escape = false
  let out = ''
  for (const ch of json) {
    if (escape) {
      escape = false
      out += ch
      continue
    }
    if (ch === '\\' && inString) escape = true
    else if (ch === '"') inString = !inString
    out += !inString && ch === '{' ? '(' : !inString && ch === '}' ? ')' : ch
  }
  return out
}

// One criterion as Stash writes it in a list URL's `c=` parameter.
// params: what the criterion's toQueryParams gives ({ type, modifier, value }).
export function encodeCriterion(params) {
  let s = encodeURI(parens(JSON.stringify(params)))
  for (const ch of '?#&;=+') s = s.replaceAll(ch, encodeURIComponent(ch))
  return s
}

// A path in Stash with a filter: listUrl('/performers', [criterion], 'disp=3')
export function listUrl(path, criteria = [], extra = '') {
  const params = [
    ...criteria.map((c) => 'c=' + encodeCriterion(c)),
    ...(extra ? [extra] : []),
  ]
  return params.length ? `${path}?${params.join('&')}` : path
}

const NO_GENDER = { type: 'gender', modifier: 'IS_NULL' }

// The Performers list filtered to "gender is null"
export const noGenderUrl = () => listUrl('/performers', [NO_GENDER])

// Stash's performer Tagger (the Performers list's Tagger view, disp=3) on
// the performers with no gender
export const taggerUrl = () => listUrl('/performers', [NO_GENDER], 'disp=3')

// The Performers list filtered on a numeric custom field: field > 0
export const customFieldUrl = (field) =>
  listUrl('/performers', [
    {
      type: 'custom_fields',
      value: [{ field, modifier: 'GREATER_THAN', value: [0] }],
    },
  ])

// Which list a list component is, from the page it is on:
//   'performers'        the Performers page
//   'scenes'            the Scenes page
//   'performer-scenes'  a performer's Scenes tab ("Bracket her scenes")
//   'scene-list'        a tag's, studio's or group's scenes
// The Performers list on other pages (a tag's performers, Appears with)
// gets no bracket buttons: null.
export function listPlace(kind, pathname) {
  const path = (pathname || '').replace(/\/+$/, '') || '/'
  if (kind === 'performer')
    return path === '/performers' ? { place: 'performers' } : null
  if (kind !== 'scene') return null
  if (path === '/scenes') return { place: 'scenes' }
  const m = path.match(/^\/performers\/(\d+)(\/|$)/)
  if (m) return { place: 'performer-scenes', performerId: m[1] }
  return { place: 'scene-list' }
}
