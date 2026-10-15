// "Remove Cherry Pick data": a tombstone in tier 1 (so another browser's
// mirror cannot bring the data back), the plugin's custom fields off every
// performer (tier 2), and this browser's cache (tier 3). Ratings the plugin
// applied are Stash's own and stay.
import {
  cancelWrites,
  patchLibraryPerformer,
  run,
  runMutation,
  store,
  tier1,
} from '../runtime/app.js'
import { PERFORMER_UPDATE, PERFORMERS_WITH_FIELD } from '../data/queries.js'
import { fromConfig } from '../storage/tier1.js'
import { clearTier3, KEYS, local } from '../storage/tier3.js'
import { EMPTY_SIGNALS } from '../model/foryou.js'
import { FIELDS } from '../model/brackets.js'

const FIELD_NAMES = Object.values(FIELDS)

// Performers holding any of the plugin's fields, with those fields.
async function performersWithFields() {
  const found = new Map()
  for (const field of FIELD_NAMES) {
    const { findPerformers } = await run(PERFORMERS_WITH_FIELD, {
      performer_filter: { custom_fields: [{ field, modifier: 'NOT_NULL' }] },
    })
    for (const p of findPerformers.performers) found.set(p.id, p)
  }
  return [...found.values()]
}

export async function removalCounts() {
  return {
    brackets: store.get().brackets.history.length,
    performers: (await performersWithFields()).length,
  }
}

export async function removePluginData() {
  cancelWrites()
  await tier1.remove()
  for (const p of await performersWithFields()) {
    const remove = FIELD_NAMES.filter((f) => f in (p.custom_fields || {}))
    await runMutation(PERFORMER_UPDATE, {
      input: { id: p.id, custom_fields: { remove } },
    })
    const rest = { ...(p.custom_fields || {}) }
    for (const f of remove) delete rest[f]
    patchLibraryPerformer(p.id, { custom_fields: rest })
  }
  await clearTier3()
  local.del(KEYS.signals)
  store.set({
    ...fromConfig(null),
    signals: EMPTY_SIGNALS,
    recentHidden: [],
    notice: { kind: 'removed' },
  })
}
