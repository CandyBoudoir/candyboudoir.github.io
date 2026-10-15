// Everything a bracket changes: the bracket in progress and the Hall of Fame
// (tier 1, through the store), the custom fields on placed performers
// (tier 2, once per finished bracket), genders set from the grid and the
// ratings an Apply sets (Stash's own records). After each Stash write the
// library copy is patched so the model sees it at once.
import {
  patchLibraryPerformer,
  patchLibraryScene,
  run,
  runMutation,
  store,
} from '../../runtime/app.js'
import * as BR from '../../model/brackets.js'
import {
  championsRoundPool,
  dominantGender,
  liveGender,
  placedIds,
  poolCounts,
  quickChoice,
  rememberedPrefs,
  resolvePerformerPool,
  restoreFieldsInput,
} from '../../model/bracketSetup.js'
import { genderLabel } from '../../model/util.js'
import { openDialog } from '../../ui/dialogs.jsx'

// Dialog views (ui/dialogs.jsx): one name each
export const VIEWS = {
  setup: 'bracket-setup',
  clipSetup: 'bracket-clip-setup',
  genders: 'bracket-genders',
  play: 'bracket-play',
  result: 'bracket-result',
  apply: 'bracket-apply',
}

const PERFORMER_GENDER = `
  mutation CherryPickSetGender($input: PerformerUpdateInput!) {
    performerUpdate(input: $input) { id gender }
  }
`
const PERFORMER_FIELDS = `
  query CherryPickBracketFields($ids: [ID!]) {
    findPerformers(ids: $ids, filter: { per_page: -1 }) {
      performers { id custom_fields }
    }
  }
`
const PERFORMER_SET_FIELDS = `
  mutation CherryPickBracketSetFields($input: PerformerUpdateInput!) {
    performerUpdate(input: $input) { id custom_fields }
  }
`
const PERFORMER_RATINGS = `
  query CherryPickPerformerRatings($ids: [ID!]) {
    findPerformers(ids: $ids, filter: { per_page: -1 }) {
      performers { id rating100 }
    }
  }
`
const SCENE_RATINGS = `
  query CherryPickSceneRatings($ids: [ID!]) {
    findScenes(ids: $ids, filter: { per_page: -1 }) {
      scenes { id rating100 }
    }
  }
`
const PERFORMER_RATE = `
  mutation CherryPickRatePerformer($input: PerformerUpdateInput!) {
    performerUpdate(input: $input) { id rating100 }
  }
`
const SCENE_RATE = `
  mutation CherryPickRateScene($input: SceneUpdateInput!) {
    sceneUpdate(input: $input) { id rating100 }
  }
`

function reportError(e) {
  console.error('CherryPick:', e)
  store.set({ error: String(e?.message || e) })
}

// ------------------------------------------------------------ genders and pools

// A performer's gender now, with Set genders taps made since the library was read
export const genderOf = (p) => liveGender(store.get().genderEdits, p)

export const poolCountsNow = () => poolCounts(store.get().M, genderOf)
export const dominantNow = () => dominantGender(poolCountsNow())

export const resolvePool = (choice, listFilter) =>
  resolvePerformerPool(store.get().M, choice, listFilter, genderOf)

// One tap in the Set genders grid: one performerUpdate, nothing guessed. The
// pool counts follow at once; the library copy once Stash has it.
export async function setPerformerGender(id, gender) {
  const before = store.get().genderEdits || {}
  store.set((s) => ({
    genderEdits: { ...(s.genderEdits || {}), [id]: gender },
  }))
  try {
    await runMutation(PERFORMER_GENDER, { input: { id, gender } })
    patchLibraryPerformer(id, { gender })
  } catch (e) {
    store.set((s) => {
      const edits = { ...(s.genderEdits || {}) }
      if (Object.prototype.hasOwnProperty.call(before, id))
        edits[id] = before[id]
      else delete edits[id]
      return { genderEdits: edits }
    })
    reportError(e)
  }
}

// "Use your largest pool": the bracket gender follows the library again
export const forgetBracketGender = () =>
  store.set((s) => ({
    bracketPrefs: { ...(s.bracketPrefs || {}), gender: null },
  }))

// ------------------------------------------------------------ starting

function begin(b) {
  store.set((s) => ({
    brackets: { ...s.brackets, active: b },
    dialog: { view: VIEWS.play },
    lastFinished: null,
  }))
}

// remember: { picked } when the choice comes from the setup sheet (picked:
// the user tapped a gender chip); null for one click, which remembers nothing
export function startPerformerBracket(choice, listFilter, remember, origin) {
  const s = store.get()
  if (!s.M) return false
  const r = resolvePool(choice, listFilter)
  if (!r.size) return false
  if (remember)
    store.set({
      bracketPrefs: rememberedPrefs(
        choice,
        remember.picked,
        s.bracketPrefs,
        dominantNow(),
      ),
    })
  begin(
    BR.createBracket(s.M, {
      kind: 'performer',
      gender: choice.gender,
      poolLabel: r.poolLabel,
      size: r.size,
      ids: r.ids,
      origin: origin || '/performers',
    }),
  )
  return true
}

// The Performers list's Bracket: one click starts 16 with the default
// gender; a filtered list is the pool. A pool that can't fill 16 opens the
// setup sheet with the fixes.
export function quickStartPerformers(listFilter) {
  if (!store.get().M) return
  const choice = quickChoice(
    store.get().bracketPrefs,
    dominantNow(),
    listFilter,
  )
  if (!startPerformerBracket(choice, listFilter, null))
    openDialog({ view: VIEWS.setup, listFilter, choice })
}

export const openPerformerSetup = (listFilter) =>
  openDialog({ view: VIEWS.setup, listFilter })

// pool: { ids, poolLabel, poolNote, short, origin }
export const openClipSetup = (pool) =>
  openDialog({ view: VIEWS.clipSetup, ...pool })

// size: the size picked in the sheet (16, 32 or 64); a pool under 16 plays
// every scene, with byes
export function startClipBracket({ ids, poolLabel, origin, size }) {
  const { M } = store.get()
  const slots = M ? BR.clipSize(ids.length, size) : null
  if (!slots) return false
  begin(
    BR.createBracket(M, {
      kind: 'clip',
      poolLabel,
      size: slots,
      ids,
      origin: origin || null,
    }),
  )
  return true
}

// "Bracket her scenes" and the Scenes list's Bracket: one click starts 16
// (every scene, with byes, under 16). Under 4 the sheet opens to say why.
export function quickStartClip(pool) {
  if (!startClipBracket({ ...pool, size: BR.DEFAULT_SIZE })) openClipSetup(pool)
}

export function startChampionsRound(gender) {
  const s = store.get()
  if (!s.M) return
  const { ids, size } = championsRoundPool(s.M, s.brackets.history, gender)
  if (!size) return
  begin(
    BR.createBracket(s.M, {
      kind: 'performer',
      gender,
      poolLabel: `${genderLabel(gender)} · Champions round`,
      size,
      ids,
      champions: true,
    }),
  )
}

// ------------------------------------------------------------ playing

// Custom-field writes of finished brackets, by bracket id: the fields each
// placed performer had before (so Undo of the final can put them back)
const fieldWrites = new Map()

function finish(next, result) {
  const finished = {
    ...next,
    status: 'done',
    finishedAt: new Date().toISOString(),
    result,
  }
  store.set((s) => ({
    brackets: { active: null, history: [...s.brackets.history, finished] },
    lastFinished: finished.id,
    dialog: { view: VIEWS.result, id: finished.id },
  }))
  if (finished.kind === 'performer')
    fieldWrites.set(finished.id, writeFields(finished))
}

// Tier 2: one performerUpdate with a partial custom_fields per placed
// performer (quarterfinals or better, at most 8), once, now. Each write fires
// other plugins' update hooks, so never per pick.
async function writeFields(b) {
  const written = {}
  try {
    const { findPerformers } = await run(PERFORMER_FIELDS, {
      ids: placedIds(b.result),
    })
    const current = Object.fromEntries(
      findPerformers.performers.map((p) => [p.id, p.custom_fields || {}]),
    )
    const updates = BR.bracketFieldUpdates(current, b)
    for (const [id, partial] of Object.entries(updates)) {
      if (!current[id]) continue // no longer in Stash
      const data = await runMutation(PERFORMER_SET_FIELDS, {
        input: { id, custom_fields: { partial } },
      })
      written[id] = Object.fromEntries(
        Object.keys(partial).map((k) => [k, current[id][k] ?? null]),
      )
      patchLibraryPerformer(id, {
        custom_fields: data.performerUpdate.custom_fields,
      })
    }
  } catch (e) {
    reportError(e)
  }
  store.set((s) => ({
    brackets: {
      ...s.brackets,
      history: s.brackets.history.map((x) =>
        x.id === b.id ? { ...x, fieldWrites: written } : x,
      ),
    },
  }))
  return written
}

// Undo of the final pick: the fields go back as they were before it
async function restoreFields(b) {
  const written = (await fieldWrites.get(b.id)) || b.fieldWrites || {}
  fieldWrites.delete(b.id)
  for (const [id, prev] of Object.entries(written)) {
    try {
      const data = await runMutation(PERFORMER_SET_FIELDS, {
        input: { id, custom_fields: restoreFieldsInput(prev) },
      })
      patchLibraryPerformer(id, {
        custom_fields: data.performerUpdate.custom_fields,
      })
    } catch (e) {
      reportError(e)
    }
  }
}

function updateActive(fn) {
  const a = store.get().brackets.active
  if (!a) return
  const next = fn(a)
  if (next === a) return
  const st = BR.bracketState(next)
  if (st.done) return finish(next, st.result)
  store.set((s) => ({
    brackets: { ...s.brackets, active: { ...next, status: 'active' } },
  }))
}

export const pickWinner = (id) => updateActive((b) => BR.pick(b, id))

export function undoPick() {
  const s = store.get()
  if (s.brackets.active) return updateActive((b) => BR.undo(b))
  // straight after the final: reopen it, and put the fields back
  const last = s.brackets.history[s.brackets.history.length - 1]
  if (!last || last.id !== s.lastFinished) return
  const reopened = { ...last }
  delete reopened.fieldWrites
  delete reopened.result
  store.set((st) => ({
    brackets: {
      active: {
        ...BR.undo(reopened),
        status: 'active',
        finishedAt: null,
      },
      history: st.brackets.history.filter((x) => x.id !== last.id),
    },
    lastFinished: null,
    dialog: { view: VIEWS.play },
  }))
  if (last.kind === 'performer') restoreFields(last)
}

// Closing the play dialog pauses; nothing is lost
export function pauseBracket() {
  store.set((s) => ({
    dialog: null,
    brackets: s.brackets.active
      ? { ...s.brackets, active: { ...s.brackets.active, status: 'paused' } }
      : s.brackets,
  }))
}
export const resumeBracket = () => openDialog({ view: VIEWS.play })

// Ends the bracket without a result: its picks stop feeding the model
export const abandonBracket = () =>
  store.set((s) => ({
    brackets: { ...s.brackets, active: null },
    dialog: null,
  }))

// ------------------------------------------------------------ Apply to my ratings

async function currentRatings(kind, ids) {
  if (kind === 'performer') {
    const { findPerformers } = await run(PERFORMER_RATINGS, { ids })
    return new Map(findPerformers.performers.map((p) => [p.id, p.rating100]))
  }
  const { findScenes } = await run(SCENE_RATINGS, { ids })
  return new Map(findScenes.scenes.map((x) => [x.id, x.rating100]))
}

async function setRating(kind, id, rating100) {
  if (kind === 'performer') {
    await runMutation(PERFORMER_RATE, { input: { id, rating100 } })
    patchLibraryPerformer(id, { rating100 })
  } else {
    await runMutation(SCENE_RATE, { input: { id, rating100 } })
    patchLibraryScene(id, { rating100 })
  }
}

// changes: [{ id, to }] from the preview. Each previous rating is read from
// Stash right before the write, so Undo puts back exactly what was there
// (unrated included). The batch lands in tier 1.
export async function applyRatingChanges(bracket, changes) {
  if (!changes.length) return
  const kind = bracket.kind
  const before = await currentRatings(
    kind,
    changes.map((c) => c.id),
  )
  const done = []
  try {
    for (const c of changes) {
      if (!before.has(c.id)) continue
      await setRating(kind, c.id, c.to)
      done.push({ id: c.id, from: before.get(c.id) ?? null, to: c.to })
    }
  } catch (e) {
    reportError(e)
  }
  if (!done.length) return
  const batch = {
    id: 'a' + Date.now().toString(36),
    at: new Date().toISOString(),
    bracketId: bracket.id,
    kind,
    poolLabel: bracket.poolLabel,
    changes: done,
  }
  store.set((s) => ({ applied: [...s.applied, batch] }))
}

export async function undoApplied(batchId) {
  const batch = store.get().applied.find((b) => b.id === batchId)
  if (!batch) return
  const left = []
  for (const c of batch.changes) {
    try {
      await setRating(batch.kind, c.id, c.from ?? null)
    } catch (e) {
      left.push(c)
      reportError(e)
    }
  }
  store.set((s) => ({
    applied: left.length
      ? s.applied.map((b) => (b.id === batchId ? { ...b, changes: left } : b))
      : s.applied.filter((b) => b.id !== batchId),
  }))
}
