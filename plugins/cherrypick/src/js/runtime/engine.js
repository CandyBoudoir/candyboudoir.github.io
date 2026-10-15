// The taste model, kept current. Whenever the library, bracket picks, Not
// interested or Don't learn change, the model is recomputed off the click
// path (a timeout, so the page that triggered it renders first) and lands in
// the store as `db` (buildDb) and `M` (the engine's answers). Pieces that
// need a score render nothing until `M` is there.
import { store } from './app.js'
import { buildDb } from '../model/db.js'
import { createEngine } from '../model/index.js'
import { modelDecisions } from '../model/brackets.js'

// Every bracket pick the model learns from: finished brackets and the one in
// progress.
export function allDecisions(state) {
  const out = []
  for (const b of state.brackets.history)
    if (b.decisions) out.push(...modelDecisions(b))
  if (state.brackets.active) out.push(...modelDecisions(state.brackets.active))
  return out
}

let built = { library: null, stashdbData: null, db: null, engine: null }
let pending = null

function recompute() {
  pending = null
  const s = store.get()
  if (!s.library) return
  if (s.library !== built.library || s.stashdbData !== built.stashdbData) {
    const db = buildDb({
      asOf: Date.parse(s.library.syncedAt),
      scenes: s.library.scenes,
      performers: s.library.performers,
      stashdb: s.stashdbData || undefined,
    })
    // Same library, new StashDB data: keep the fit, which reads only the
    // scenes the user owns.
    const reuse = s.library === built.library && built.engine
    built = {
      library: s.library,
      stashdbData: s.stashdbData,
      db,
      engine: createEngine(db, reuse ? { fits: built.engine.cache } : {}),
    }
  }
  const t0 = performance.now()
  const M = built.engine.compute({
    overrides: {},
    performerOverrides: {},
    decisions: allDecisions(s),
    notInterested: s.notInterested,
    dontLearn: s.dontLearn.map((d) => d.sceneId),
  })
  store.set({
    db: built.db,
    M,
    modelMs: Math.round(performance.now() - t0),
    // the StashDB data this model was built with (stashdb/layer.js waits
    // for it before showing a page's answers)
    modelStashdb: built.stashdbData,
  })
}

// The model as it would be with other bracket picks: the champion screen
// counts the unrated scenes whose Your score one bracket's picks moved.
export function computeWithDecisions(decisions) {
  const s = store.get()
  if (!built.engine || built.library !== s.library) return null
  return built.engine.compute({
    overrides: {},
    performerOverrides: {},
    decisions,
    notInterested: s.notInterested,
    dontLearn: s.dontLearn.map((d) => d.sceneId),
  })
}

const INPUTS = [
  'library',
  'stashdbData',
  'brackets',
  'notInterested',
  'dontLearn',
]

export function keepModelCurrent() {
  store.subscribe((next, prev) => {
    if (!INPUTS.some((k) => next[k] !== prev[k])) return
    if (!pending) pending = setTimeout(recompute, 0)
  })
}
