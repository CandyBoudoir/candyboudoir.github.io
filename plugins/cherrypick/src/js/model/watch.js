// Watch This: one scene ready to play in place of Cherry Pick's front-page
// rows (features/watchThis.jsx). The pick is For you's own order before
// variety and exploration (taste, momentum and freshness), over the scenes
// you own whose file has a picture; Watch This has no exploration slots. A
// library under 30 scenes plays the newest, the one New in your library
// would put first.
import {
  allowed,
  newInLibrary,
  rankedScenes,
  reasonFor,
  tooSmall,
} from './foryou.js'
import { timeAgo } from './util.js'

// A scene Watch This can play: its first file has video. An audio-only file
// (no video codec, a width of 0) and a scene with no file have none.
export const playable = (s) => !!s.hasVideo

/**
 * One scene Watch This could play.
 * @typedef {object} WatchItem
 * @property {import('./db.js').Scene} scene
 * @property {() => string} reason  the line's reason, worked out when shown
 */

// Every scene Watch This could play this visit, best first.
// signals: the visit's For you signals (visitSignals), which it reads and
// never changes.
/** @returns {WatchItem[]} */
export function watchOrder(ctx, signals) {
  if (tooSmall(ctx.db)) return newestOrder(ctx)
  return rankedScenes(ctx, signals, playable).map((x) => ({
    scene: x.scene,
    reason: () => reasonFor(ctx, x),
  }))
}

// A small library: New in your library's order, then the scenes it leaves
// out (rated under 3 stars, or played in the last two weeks), newest first,
// so a library with any scene that has video has one to play.
function newestOrder(ctx) {
  const first = newInLibrary(ctx, { keep: playable, size: Infinity })
  const seen = new Set(first.map((it) => it.scene.id))
  const rest = ctx.db.owned
    .filter((s) => playable(s) && allowed(ctx, s) && !seen.has(s.id))
    .sort((a, b) => b.local.created_at.localeCompare(a.local.created_at))
  return [
    ...first.map((it) => ({ scene: it.scene, reason: () => it.reason })),
    ...rest.map((s) => ({
      scene: s,
      reason: () => `Added ${timeAgo(s.local.created_at, ctx.now)}`,
    })),
  ]
}
