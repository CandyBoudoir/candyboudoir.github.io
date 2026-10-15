// The engine: fits the taste model, folds in bracket picks and "Not
// interested" feedback, and answers the questions the views ask
// (what's the score, why, how does it rank among your scenes).

import {
  buildSamples,
  fit,
  crossValidate,
  predict,
  PARAMS,
  sceneFeatures,
} from './taste.js'
import { replay } from './bt.js'
import { behaviourOf } from './behaviour.js'
import { sceneRating, pronoun, fmtStars } from './util.js'

export { fmtStars }

export const NI_PENALTY = 0.18 // stars taken off whatever made a "Not interested" card appear
const FAVOURITE_BONUS = 0.15
const PERFORMER_RATING_WEIGHT = 0.3 // stars of affinity per star of performer rating above 3.5

const fmt1 = fmtStars

/**
 * What compute takes. Every field is optional; ids are the database's.
 * @typedef {object} EngineInput
 * @property {Record<string, number|null>} [overrides]  scene id -> rating100,
 *   for ratings changed since the library was read (an applied batch, an undo)
 * @property {Record<string, number|null>} [performerOverrides]  performer id
 *   -> rating100, likewise
 * @property {import('./bt.js').Decision[]} [decisions]  every bracket pick,
 *   oldest first (brackets.js modelDecisions, over finished brackets and the
 *   one in progress)
 * @property {NotInterested[]} [notInterested]
 * @property {string[]} [dontLearn]  ids of scenes marked "Don't learn from
 *   this": their ratings, plays and clip-bracket picks stay out of the model
 */

/**
 * A scene marked Not interested. Other fields the UI keeps on it (title,
 * date, label) are ignored here.
 * @typedef {object} NotInterested
 * @property {string} sceneId
 * @property {string|null} key  the feature that made the card appear
 *   ("p:<id>", "s:<id>" or "t:<id>": the row item's key, else blameKey)
 */

function featureStats(db, overrides, skip) {
  const stats = new Map()
  const bump = (k, scene, r, b) => {
    let st = stats.get(k)
    if (!st)
      stats.set(
        k,
        (st = { n: 0, sum: 0, watched: 0, rewatched: 0, through: 0 }),
      )
    if (r != null) {
      st.n++
      st.sum += r / 20
    }
    if (b) {
      st.watched++
      if (b.rewatchDays >= 1) st.rewatched++
      if (b.watchThrough >= 0.9) st.through++
    }
  }
  for (const s of db.owned) {
    if (skip.has(s.id)) continue
    const r = sceneRating(s, overrides)
    const b = behaviourOf(s)
    for (const [k] of sceneFeatures(s)) bump(k, s, r, b)
  }
  for (const st of stats.values()) st.mean = st.n ? st.sum / st.n : null
  return stats
}

/** @param {import('./db.js').Db} db */
export function createEngine(db) {
  const cache = {}

  // skip: Set of scene ids marked "Don't learn from this"
  function fits(overrides, skip = new Set()) {
    const key =
      JSON.stringify(overrides || {}) + '|' + [...skip].sort().join(',')
    if (cache.key === key) return cache.fits
    const { rated, watchedUnrated } = buildSamples(db, overrides, skip)
    const f = {
      rated,
      watchedUnrated,
      full: fit(rated, watchedUnrated, { ...PARAMS, useBehaviour: true }),
      content: fit(rated, watchedUnrated, { ...PARAMS, useBehaviour: false }),
      cv: crossValidate(rated, watchedUnrated, PARAMS),
      stats: featureStats(db, overrides, skip),
    }
    cache.key = key
    cache.fits = f
    return f
  }

  /** @param {EngineInput} input */
  function compute(input) {
    const overrides = input.overrides || {}
    const performerOverrides = input.performerOverrides || {}
    const dontLearn = new Set(input.dontLearn || [])
    const F = fits(overrides, dontLearn)
    // Stash's performer rating, after edits made since the library was read
    const performerRating = (id) => {
      if (Object.prototype.hasOwnProperty.call(performerOverrides, id))
        return performerOverrides[id]
      return db.performers.get(id)?.local?.rating100 ?? null
    }
    // How you rate their scenes: the model's weight where their scenes are in
    // the sample. (The mockup fell back to a summary of scenes outside its
    // 119-scene sample. Every scene in the library is in db.owned here, so a
    // performer with no rated or watched scene has no weight yet.)
    const sceneTaste = (id) => F.content.W.get('p:' + id) ?? 0
    const penalty = new Map()
    for (const ni of input.notInterested || [])
      if (ni.key) penalty.set(ni.key, (penalty.get(ni.key) || 0) - NI_PENALTY)

    const rating = (scene) => sceneRating(scene, overrides)
    const modelFor = (scene) =>
      scene.owned && behaviourOf(scene) ? F.full : F.content

    const baseCache = new Map()
    const baseScene = (id) => {
      if (!baseCache.has(id)) {
        const s = db.scenes.get(id)
        const r = rating(s)
        baseCache.set(
          id,
          r != null ? r / 20 : predict(modelFor(s), s, { penalty }).value,
        )
      }
      return baseCache.get(id)
    }
    const basePerformer = (id) => {
      const r = performerRating(id)
      return (
        sceneTaste(id) +
        (r != null ? PERFORMER_RATING_WEIGHT * (r / 20 - 3.5) : 0) +
        (penalty.get('p:' + id) || 0) +
        (db.favoritePerformerIds.has(id) ? FAVOURITE_BONUS : 0)
      )
    }
    const btKeys = (id) =>
      sceneFeatures(db.scenes.get(id))
        .map(([k]) => k)
        .filter((k) => k[0] === 'p' || k[0] === 's')
    // clip picks involving a "Don't learn" scene teach nothing
    const decisions = (input.decisions || []).filter(
      (d) =>
        d.kind === 'performer' ||
        (!dontLearn.has(d.winner) && !dontLearn.has(d.loser)),
    )
    const bt = replay(decisions, { baseScene, keys: btKeys, basePerformer })

    const extraFor = (scene) => ({
      penalty,
      featureDelta: bt.featureDelta,
      performerOffset: bt.performerOffset,
      sceneOffset: bt.sceneOffset.get(scene.id) || 0,
    })

    const predictions = new Map()
    for (const s of db.scenes.values())
      predictions.set(s.id, predict(modelFor(s), s, extraFor(s)))

    // your ratings and their spread
    const ratedStars = F.rated.map((x) => x.y)
    const userMean = ratedStars.length
      ? ratedStars.reduce((a, b) => a + b, 0) / ratedStars.length
      : 3
    const highShare = ratedStars.length
      ? ratedStars.filter((y) => y >= 4).length / ratedStars.length
      : 0
    const inflated = userMean >= 3.6 && highShare >= 0.5

    // Relative labels rank a score among your Your scores: every owned scene
    // you haven't rated ("Top 10% for you" = top tenth of what's left to rate)
    const dist = db.owned
      .filter((s) => rating(s) == null)
      .map((s) => predictions.get(s.id).value)
    const topShareOf = (v) =>
      dist.length ? dist.filter((x) => x > v + 1e-9).length / dist.length : 0.5

    const cv = F.cv
    // Your score shows only when it beats your average on held-out ratings
    const gate = !!cv && cv.maeModel < cv.maeBase

    const estimate = (id) => {
      const s = db.scenes.get(id)
      const r = rating(s)
      if (r != null)
        return Math.min(
          5,
          Math.max(0.5, r / 20 + (bt.sceneOffset.get(id) || 0)),
        )
      return predictions.get(id).value
    }

    const performerAffinity = (id) =>
      basePerformer(id) + (bt.performerOffset.get(id) || 0)

    // How they sit in your scene ratings: { n, mean } from rated scenes,
    // watched counts likewise
    const performerSceneStats = (id) => {
      const st = F.stats.get('p:' + id)
      if (st && (st.n || st.watched))
        return { n: st.n, mean: st.mean, watched: st.watched }
      return { n: 0, mean: null, watched: 0 }
    }

    return {
      db,
      overrides,
      performerOverrides,
      dontLearn,
      performerRating,
      performerSceneStats,
      fits: F,
      cv,
      gate,
      penalty,
      bt,
      predictions,
      userMean,
      highShare,
      inflated,
      rating,
      estimate,
      performerAffinity,
      prediction: (id) => predictions.get(id),
      topShare: (v) => topShareOf(v),
      stats: F.stats,
      // positive: explain what speaks for it, even when the score is below average (for picks)
      reason: (id, positive) =>
        reasonFor(
          db,
          F,
          bt,
          predictions.get(id),
          db.scenes.get(id),
          positive ? -Infinity : userMean,
        ),
    }
  }

  return { compute, fits }
}

// ---------------------------------------------------------------- labels

// Badge text. Stars: "~4.5" on the card corner, "likely 4.5★ for you" on the
// scene page. Relative (a setting): where it ranks among your unrated scenes.
export function badgeLabel(M, value, relativeStyle) {
  const half = Math.round(value * 2) / 2
  if (!relativeStyle)
    return {
      corner: '~' + fmt1(value),
      line: `likely ${half % 1 ? half.toFixed(1) : half}★ for you`,
      relative: false,
    }
  const share = M.topShare(value)
  let short
  if (share < 0.1) short = 'Top 10%'
  else if (share < 0.25) short = 'Top 25%'
  else if (share < 0.5) short = 'Top half'
  else if (share < 0.75) short = 'Lower half'
  else short = 'Bottom 25%'
  return {
    corner: short,
    line: `likely ${short.toLowerCase()} for you`,
    relative: true,
    share,
  }
}

// ---------------------------------------------------------------- reasons

// One plain sentence from the biggest contribution pointing the same way
// as the score (above your average: biggest plus; below: biggest minus).
function reasonFor(db, F, bt, pred, scene, userMean) {
  if (!pred) return null
  const dir = pred.value >= userMean ? 1 : -1
  const parts = pred.parts.slice().sort((a, b) => dir * b.value - dir * a.value)
  for (const part of parts) {
    if (dir * part.value < 0.03) break
    const text = phrase(db, F, bt, part, scene, dir)
    if (text) return { text, key: part.key }
  }
  return {
    text:
      dir > 0
        ? 'A lot like scenes you rate well'
        : 'Not much like what you rate well',
    key: null,
  }
}

function phrase(db, F, bt, part, scene, dir) {
  const k = part.key
  if (k === 'b') {
    const b = part.behaviour
    if (dir > 0) {
      if (b.rewatchDays >= 1)
        return `You've come back to it on ${b.days} different days`
      if (b.watchThrough >= 0.9) return 'You watched it all the way through'
      return 'You keep it playing longer than most'
    }
    return `You stopped about ${Math.max(5, Math.round((b.watchThrough * 100) / 5) * 5)}% of the way in`
  }
  if (k === 'o') {
    const w = bt.wins.get(scene.id) || 0
    const l = bt.losses.get(scene.id) || 0
    if (dir > 0 && w)
      return `Won ${w} match${w === 1 ? '' : 'es'} in your brackets`
    if (dir < 0 && l) return 'Went out early in a bracket'
    return null
  }
  const id = k.slice(2)
  const st = F.stats.get(k)
  if (k[0] === 'p') {
    const p = db.performers.get(id)
    if (!p) return null
    if (
      part.value &&
      bt.performerOffset.get(id) &&
      Math.abs(bt.performerOffset.get(id)) > Math.abs(F.content.W.get(k) || 0)
    ) {
      return dir > 0
        ? `${p.name} did well in your performer bracket`
        : `${p.name} went out early in your performer bracket`
    }
    if (st && st.n >= 2)
      return `You average ${fmt1(st.mean)}★ on ${p.name}'s scenes`
    if (st && st.n === 1)
      return `You rated ${pronoun(p)} other scene ${fmt1(st.mean)}★`
    if (st && st.through >= 2 && dir > 0)
      return `You watch ${p.name}'s scenes all the way through`
    return dir > 0
      ? `${p.name} shows up in scenes you rate well`
      : `${p.name} shows up in scenes you rate lower`
  }
  if (k[0] === 's') {
    const s = db.studios.get(id)
    if (!s) return null
    if (st && st.n >= 2)
      return `You average ${fmt1(st.mean)}★ on ${s.name} scenes`
    if (st && st.rewatched >= 2 && dir > 0)
      return `Same studio as ${st.rewatched} scenes you've watched twice`
    return null
  }
  if (k[0] === 't') {
    const t = db.tags.get(id)
    if (!t || !st || st.n < 3) return null
    return `Scenes tagged ${t.name} average ${fmt1(st.mean)}★ for you`
  }
  return null
}

// The key most responsible for a scene showing up, for "Not interested"
export function blameKey(pred) {
  if (!pred) return null
  const pos = pred.parts
    .filter((p) => p.key !== 'b' && p.key !== 'o')
    .sort((a, b) => b.value - a.value)[0]
  return pos && pos.value > 0 ? pos.key : null
}

export function keyLabel(db, key) {
  if (!key) return null
  const id = key.slice(2)
  if (key[0] === 'p') return db.performers.get(id)?.name
  if (key[0] === 's') return db.studios.get(id)?.name
  if (key[0] === 't') return 'tag ' + db.tags.get(id)?.name
  return null
}
