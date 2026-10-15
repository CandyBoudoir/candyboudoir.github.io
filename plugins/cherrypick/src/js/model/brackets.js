// Single-elimination brackets: pools, sizes, 1-v-N seeding, byes, playing
// order, undo, results, rating proposals. Pure functions over a plain bracket
// object that the plugin persists (tier 1), so a paused bracket survives a
// reload. Performer brackets are the main game; clip brackets ("Bracket her
// scenes", the Scenes list's Bracket button) are secondary.

import { behaviourOf } from './behaviour.js'
import { FIELD_PREFIX } from '../name.js'

export const SIZES = [16, 32, 64]
// Every bracket starts at 16 when the pool fills it; 32 and 64 only when picked
export const DEFAULT_SIZE = 16
export const MIN_CLIP_POOL = 4
export const CHAMPIONS_MIN = 4

/**
 * A bracket, as the plugin stores it.
 * @typedef {object} Bracket
 * @property {string} id
 * @property {'performer'|'clip'} kind
 * @property {string|null} gender  Stash's gender value (performer brackets)
 * @property {string} poolLabel
 * @property {number} size  slots: 4, 8, 16, 32 or 64 (byes fill the rest)
 * @property {boolean} champions  a Champions round
 * @property {string|null} origin  the page it was started from
 * @property {string[]} seeds  performer or scene ids, strongest first
 * @property {Record<string, number>} seedStrength
 * @property {{ winner: string, loser: string }[]} decisions  picks, in order
 * @property {string} createdAt  ISO
 * @property {string|null} finishedAt  ISO
 * @property {'active'|'done'} status
 * @property {BracketResult} [result]  set by the plugin when it finishes
 *   (bracketState's result)
 */

/**
 * @typedef {object} BracketResult
 * @property {string} champion
 * @property {string} finalist
 * @property {string[]} semifinalists
 * @property {string[]} quarterfinalists
 */

// ---------------------------------------------------------------- performer pools

// Who can enter a performer bracket: in your library, with a photo and a scene
export const eligible = (p) =>
  !!(p.local && p.image && p.local.scene_count >= 1)

// The performer's gender in Stash as read; the UI passes one with edits
// made since (Set genders) applied
const stashGender = (p) => p.local?.gender ?? null

// opts: { gender, pool: 'library'|'favorites'|'filter', filterIds?: Set }
// genderOf: the performer's gender in Stash right now
export function performerPool(M, opts, genderOf = stashGender) {
  return M.db.localPerformers
    .filter(eligible)
    .filter((p) => genderOf(p) === opts.gender)
    .filter(
      (p) => opts.pool !== 'favorites' || M.db.favoritePerformerIds.has(p.id),
    )
    .filter(
      (p) =>
        opts.pool !== 'filter' || !opts.filterIds || opts.filterIds.has(p.id),
    )
    .map((p) => p.id)
}

// Eligible except that Stash has no gender for them
export function genderless(M, genderOf = stashGender) {
  return M.db.localPerformers.filter(
    (p) => p.local.scene_count >= 1 && !genderOf(p),
  )
}

// The size a choice plays at: the picked size if the pool fills it, else 16
// if the pool fills that, else none (the setup sheet then offers fixes)
export const resolveSize = (pref, n) =>
  SIZES.includes(pref) && n >= pref
    ? pref
    : n >= DEFAULT_SIZE
      ? DEFAULT_SIZE
      : null

// Clip pools: the picked size (16, 32 or 64) as resolveSize gives it when the
// pool fills 16; a smaller pool (4 to 15) plays all of its scenes, in the
// next round size up, with byes for the top seeds
export function clipSize(n, pref = DEFAULT_SIZE) {
  if (n >= DEFAULT_SIZE) return resolveSize(pref, n)
  if (n < MIN_CLIP_POOL) return null
  let s = 4
  while (s < n) s *= 2
  return s
}

// "the 7" / "your top 16 of the 60": the Bracket buttons' tooltips, naming
// what one click starts (16, or every scene under 16); Options has 32 and 64
export const clipPoolPhrase = (n) =>
  n <= DEFAULT_SIZE ? `the ${n}` : `your top ${DEFAULT_SIZE} of the ${n}`

// How many of a clip pool of 4 to 15 get a bye in the first round
export const clipByes = (n) =>
  n >= MIN_CLIP_POOL && n < DEFAULT_SIZE ? clipSize(n) - n : 0

export const watchedScenes = (db) => db.owned.filter((s) => behaviourOf(s))

// ---------------------------------------------------------------- seeding

// 1 v N: [1,2] -> [1,4,2,3] -> [1,8,4,5,2,7,3,6] ... so 1 and 2 can only meet in the final
export function seedOrder(n) {
  let s = [1]
  while (s.length < n) {
    const m = s.length * 2
    s = s.flatMap((x) => [x, m + 1 - x])
  }
  return s
}

// kind: 'performer' | 'clip'; ids: the pool; size: slots (byes fill the rest).
// now: when it is created, for its id and createdAt: the time of the click,
// not the library's asOf, so two brackets in one session get different ids.
export function createBracket(
  M,
  {
    kind,
    gender = null,
    poolLabel,
    size,
    ids,
    champions = false,
    origin = null,
    now = Date.now(),
  },
) {
  const strength =
    kind === 'performer'
      ? (id) => M.performerAffinity(id)
      : (id) => M.estimate(id)
  const seeds = ids
    .slice()
    .sort((a, b) => strength(b) - strength(a))
    .slice(0, size)
  return {
    id: 'b' + now.toString(36),
    kind,
    gender,
    poolLabel,
    size,
    champions,
    origin,
    seeds,
    seedStrength: Object.fromEntries(
      seeds.map((id) => [id, Math.round(strength(id) * 100) / 100]),
    ),
    decisions: [],
    createdAt: new Date(now).toISOString(),
    finishedAt: null,
    status: 'active',
  }
}

// ---------------------------------------------------------------- playing

export function roundName(slotsInRound) {
  if (slotsInRound === 2) return 'Final'
  if (slotsInRound === 4) return 'Semifinals'
  if (slotsInRound === 8) return 'Quarterfinals'
  return `Round of ${slotsInRound}`
}

// Rebuild the whole tree from the seeds and the picks made so far. A missing
// entrant (smaller pools) is a bye: the other side goes through untouched.
export function bracketState(b) {
  const order = seedOrder(b.size)
  let entrants = order.map((seed) => b.seeds[seed - 1] || null)
  const rounds = []
  let di = 0
  let current = null
  while (entrants.length > 1) {
    const matches = []
    for (let i = 0; i < entrants.length; i += 2)
      matches.push({
        a: entrants[i],
        b: entrants[i + 1],
        winner: null,
        bye: false,
      })
    rounds.push(matches)
    const first = rounds.length === 1
    matches.forEach((m, mi) => {
      if (!m.a || !m.b) {
        // a missing seed in the first round is a bye; later it's still to be decided
        if (first) {
          m.winner = m.a || m.b
          m.bye = true
        }
        return
      }
      const d = b.decisions[di]
      if (!current && d) {
        m.winner = d.winner
        di++
      } else if (!current) {
        current = { round: rounds.length - 1, index: mi, a: m.a, b: m.b }
      }
    })
    entrants = matches.map((m) => m.winner)
  }
  const seedOf = (id) => b.seeds.indexOf(id) + 1
  const loserOf = (m) => (m.winner === m.a ? m.b : m.a)
  const done = !current
  const n = rounds.length
  const result = done
    ? {
        champion: rounds[n - 1][0].winner,
        finalist: loserOf(rounds[n - 1][0]),
        semifinalists: n >= 2 ? rounds[n - 2].map(loserOf).filter(Boolean) : [],
        quarterfinalists:
          n >= 3 ? rounds[n - 3].map(loserOf).filter(Boolean) : [],
      }
    : null
  let label = 'Finished'
  let roundLabel = null
  if (current) {
    const r = rounds[current.round]
    const real = r.filter((m) => !m.bye)
    const idx = real.indexOf(r[current.index])
    roundLabel = roundName(r.length * 2)
    label =
      real.length > 1
        ? `${roundLabel} · match ${idx + 1} of ${real.length}`
        : roundLabel
  }
  return {
    rounds,
    current,
    done,
    result,
    seedOf,
    played: b.decisions.length,
    totalMatches: b.seeds.length - 1,
    label,
    roundLabel,
  }
}

export function pick(b, winner) {
  const st = bracketState(b)
  if (!st.current) return b
  const loser = winner === st.current.a ? st.current.b : st.current.a
  return { ...b, decisions: [...b.decisions, { winner, loser }] }
}

export function undo(b) {
  if (!b.decisions.length) return b
  return { ...b, decisions: b.decisions.slice(0, -1) }
}

// A bracket's picks as the engine takes them (EngineInput.decisions)
export function modelDecisions(b) {
  return (b.decisions || []).map((d) => ({
    kind: b.kind,
    winner: d.winner,
    loser: d.loser,
    bracket: b.id,
  }))
}

// ---------------------------------------------------------------- results across brackets

const performerBrackets = (history) =>
  history.filter((b) => b.kind === 'performer' && b.result)

// { [performerId]: { champion: n, finalist: n } }
export function performerHonours(history) {
  const out = {}
  const bump = (id, k) => {
    if (!id) return
    out[id] = out[id] || { champion: 0, finalist: 0 }
    out[id][k]++
  }
  for (const b of performerBrackets(history)) {
    bump(b.result.champion, 'champion')
    bump(b.result.finalist, 'finalist')
  }
  return out
}

// Distinct champions of ordinary performer brackets of one gender, newest first
export function championsOf(history, gender) {
  const seen = new Set()
  return performerBrackets(history)
    .filter((b) => !b.champions && b.gender === gender)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    .map((b) => b.result.champion)
    .filter((id) => !seen.has(id) && seen.add(id))
}

export function championsRoundSize(n) {
  if (n < CHAMPIONS_MIN) return 0
  let s = 4
  while (s * 2 <= Math.min(n, 16)) s *= 2
  return s
}

// ---------------------------------------------------------------- tier 2: custom fields on performers

// Namespaced custom fields the plugin writes on a performer at the end of a
// bracket (performerUpdate, custom_fields partial). Stash shows them in the
// performer's details and can filter the Performers list by them.
export const FIELDS = {
  titles: FIELD_PREFIX + 'titles', // number: brackets won
  best: FIELD_PREFIX + 'best_finish', // string: champion, final, semifinal, quarterfinal
  last: FIELD_PREFIX + 'last_bracket', // date: the last bracket they placed in
}
export const FIELD_TYPES = {
  [FIELDS.titles]: 'number',
  [FIELDS.best]: 'string',
  [FIELDS.last]: 'date',
}
const FINISH_ORDER = ['quarterfinal', 'semifinal', 'final', 'champion']

// The partial custom fields one finished performer bracket writes: one
// performerUpdate per placed performer (quarterfinals and better, at most 8),
// once, when the bracket ends. current: { [performerId]: fields } now.
export function bracketFieldUpdates(current, b) {
  if (b.kind !== 'performer' || !b.result) return {}
  const r = b.result
  const date = (b.finishedAt || '').slice(0, 10)
  const placed = [
    [r.champion, 'champion'],
    [r.finalist, 'final'],
    ...(r.semifinalists || []).map((x) => [x, 'semifinal']),
    ...(r.quarterfinalists || []).map((x) => [x, 'quarterfinal']),
  ].filter(([x]) => x)
  const out = {}
  for (const [id, finish] of placed) {
    const cur = current[id] || {}
    const prev = cur[FIELDS.best]
    out[id] = {
      [FIELDS.titles]:
        (cur[FIELDS.titles] || 0) + (finish === 'champion' ? 1 : 0),
      [FIELDS.best]:
        FINISH_ORDER.indexOf(finish) > FINISH_ORDER.indexOf(prev)
          ? finish
          : prev,
      [FIELDS.last]: date,
    }
  }
  return out
}

// Fields as they'd stand after a run of brackets, oldest first (to rebuild
// them from the Hall of Fame)
export function fieldsFromHistory(history) {
  const cf = {}
  const runs = history
    .filter((b) => b.kind === 'performer' && b.result)
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  for (const b of runs) {
    const up = bracketFieldUpdates(cf, b)
    for (const [id, f] of Object.entries(up))
      cf[id] = { ...(cf[id] || {}), ...f }
  }
  return cf
}

// ---------------------------------------------------------------- Apply to my ratings

// Tiers: champion 5★, finalist 4.5★, semifinalists 4★, quarterfinalists 3.5★.
// By default only for what you haven't rated; includeRated also raises (never
// lowers) ratings you set lower than the tier.
export const TIERS = [
  ['champion', 100, 'Champion'],
  ['finalist', 90, 'Finalist'],
  ['semifinalists', 80, 'Semifinalist'],
  ['quarterfinalists', 70, 'Quarterfinalist'],
]

export function ratingProposals(M, b, includeRated) {
  const r = b.result
  const out = []
  for (const [key, to, why] of TIERS) {
    const ids = Array.isArray(r[key]) ? r[key] : [r[key]]
    for (const id of ids) {
      if (!id) continue
      const from =
        b.kind === 'performer'
          ? M.performerRating(id)
          : M.rating(M.db.scenes.get(id))
      if (from == null || (includeRated && to > from))
        out.push({ id, from, to, why })
    }
  }
  return out
}
