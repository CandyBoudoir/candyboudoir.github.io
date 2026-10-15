// Behaviour score: how much someone seems to like a scene from what they did
// with it, using only fields Stash already stores on every scene:
// play_duration / duration (watch-through), play_history (rewatches on
// separate days) and o_counter. Mapped to 0..1. Never-played scenes have none.

import { localDay } from './util.js'

// Worked out once per scene: the fit, the predictions, For you and More like
// this all ask, and counting days formats every play, which was a fifth of
// the time on a 10,000-scene library. Keyed on `local`, the Stash fields it
// reads, which the database never changes (db.js).
const cache = new WeakMap()

export function behaviourOf(scene) {
  const l = scene.local
  if (!l || !l.play_count) return null
  let b = cache.get(l)
  if (!b) {
    const duration = scene.duration || 1800
    const watchThrough = Math.min(1, l.play_duration / duration) // capped: rewatches don't push it past 1
    const days = new Set(l.play_history.map(localDay)).size
    const rewatchDays = Math.max(0, days - 1)
    const o = l.o_counter || 0
    const score =
      0.5 * watchThrough +
      0.3 * (1 - Math.exp(-rewatchDays / 2)) +
      0.2 * (1 - Math.exp(-o / 1.5))
    b = { score, watchThrough, days, rewatchDays, o, plays: l.play_count }
    cache.set(l, b)
  }
  return b
}

// "Barely played": never played, or played on one day only and not
// all the way through
export function barelyPlayed(scene) {
  const b = behaviourOf(scene)
  if (!b) return true
  return b.days <= 1 && b.watchThrough < 0.9
}
