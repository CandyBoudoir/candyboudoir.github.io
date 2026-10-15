// The plugin's state and how it comes to life. Stash renders Cherry Pick's
// pieces in many separate places (cards, rows, the scene page, dialogs), so
// they all read one store and change it through actions.
//
// Boot: read the plugin's configuration (tier 1), then the library (from the
// IndexedDB copy if there is one, refreshed in the background), then fit the
// taste model. Each step updates the store, and pieces render as soon as what
// they need is there.
import { PLUGIN_ID } from '../name.js'
import { createStore } from './store.js'
import { client, gql, GQL, mutate, query, utils } from './api.js'
import { inSettings, onFrontPage, onLocation } from './location.js'
import * as Q from '../data/queries.js'
import { loadLibrary, REFRESH_MS } from '../data/library.js'
import {
  createTier1,
  fromConfig,
  STATE_TO_CONFIG,
  toConfig,
} from '../storage/tier1.js'
import { cache, KEYS, local } from '../storage/tier3.js'
import { SETTING_KEYS } from '../storage/settings.js'
import { EMPTY_SIGNALS } from '../model/foryou.js'
import { isStashdbEndpoint } from '../stashdb/queries.js'

const docs = new Map()
const doc = (text) => {
  if (!docs.has(text)) docs.set(text, gql(text))
  return docs.get(text)
}
// One GraphQL request through Stash's client, outside Apollo's cache.
export const run = (text, variables) => query(doc(text), variables, 'no-cache')
export const runMutation = (text, variables) => mutate(doc(text), variables)

export const store = createStore({
  ...fromConfig(null),
  configLoaded: false,
  // the library as Stash returned it, and when
  library: null,
  // the StashDB stash-box from Stash's settings, if any: { endpoint, apiKey }
  stashdb: null,
  // what the StashDB layer fetched (buildDb's stashdb input), and the state
  // of each page's lookups (stashdb/layer.js)
  stashdbData: null,
  stashdbLookups: {},
  // For you's row signals (tier 3)
  signals: { ...EMPTY_SIGNALS, ...(local.get(KEYS.signals) || {}) },
  // session only
  watching: false,
  dialog: null,
  visit: 0,
  recentHidden: [],
  notice: null,
  error: null,
})

const readPluginMap = async () => {
  const { configuration } = await run(Q.CONFIGURATION)
  return configuration.plugins?.[PLUGIN_ID] ?? null
}

// After a write, drop Stash's cached configuration as Stash's own
// useConfigurePlugin does, so its Settings page and the next plugin-settings
// save start from what was written.
async function writePluginMap(map) {
  await runMutation(Q.CONFIGURE_PLUGIN, { plugin_id: PLUGIN_ID, input: map })
  utils.StashService.evictQueries(client().cache, [GQL.ConfigurationDocument])
}

export const tier1 = createTier1({
  read: readPluginMap,
  write: writePluginMap,
  mirror: {
    get: () => local.get(KEYS.mirror),
    set: (map) => local.set(KEYS.mirror, map),
    del: () => local.del(KEYS.mirror),
  },
  settingsOpen: () => inSettings(),
})

// Writes what changed to where it lives: tier 1 for the plugin's own data,
// tier 3 for row signals. Settings are Stash's to write. Tier 1 writes wait
// for a second of quiet (every write makes Stash refetch its
// configuration, and bracket picks come quickly); the mirror takes each
// change at once.
const WRITE_DELAY_MS = 1000
const unsaved = new Set()
let saveTimer = null

function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = null
  if (!unsaved.size) return Promise.resolve()
  const keys = [...unsaved]
  unsaved.clear()
  return tier1.save(toConfig(store.get()), keys).catch(reportError)
}

function persist(next, prev) {
  // Loading the configuration is not a change to write back.
  if (!next.configLoaded || !prev.configLoaded || next === prev) return
  const keys = []
  for (const [k, cfg] of Object.entries(STATE_TO_CONFIG))
    if (prev[k] !== next[k]) keys.push(...cfg)
  if (keys.length) {
    tier1.stage(toConfig(next), keys)
    keys.forEach((k) => unsaved.add(k))
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, WRITE_DELAY_MS)
  }
  if (prev.signals !== next.signals) local.set(KEYS.signals, next.signals)
}

// Writes anything waiting now (before leaving, or when a flow ends).
export const flushWrites = saveNow

// Drops writes still waiting (the plugin's data is being removed).
export function cancelWrites() {
  clearTimeout(saveTimer)
  saveTimer = null
  unsaved.clear()
}

function reportError(e) {
  console.error(`${PLUGIN_ID}:`, e)
  store.set({ error: String(e?.message || e) })
}

async function loadConfig() {
  const { configuration } = await run(Q.CONFIGURATION)
  const box = (configuration.general.stashBoxes || []).find((b) =>
    isStashdbEndpoint(b.endpoint),
  )
  const { map, restored } = await tier1.load()
  store.set({
    ...fromConfig(map),
    configLoaded: true,
    stashdb: box?.api_key
      ? { endpoint: box.endpoint, apiKey: box.api_key }
      : null,
  })
  if (restored) {
    // Put back what the mirror restored, before anything else writes.
    await tier1.save(toConfig(store.get()), Object.keys(toConfig(store.get())))
    store.set({ notice: { kind: 'restored', restored } })
  }
  // Stash shows a setting nobody has touched as off, and its first click
  // would turn it on. Writing the defaults once makes its switches match.
  const missing = SETTING_KEYS.filter((k) => map?.[k] == null)
  if (missing.length) await tier1.save(toConfig(store.get()), missing)
}

// Settings changed on Stash's own page: read them again.
async function reloadSettings() {
  const map = await readPluginMap()
  store.set({ settings: fromConfig(map).settings })
}

let loading = null
export function refreshLibrary(force = false) {
  if (loading) return loading
  loading = loadLibrary({ run, cache, force })
    .then((library) => {
      const cur = store.get().library
      if (!cur || library.syncedAt !== cur.syncedAt) store.set({ library })
    })
    .catch(reportError)
    .finally(() => (loading = null))
  return loading
}

let booted = false
export function boot() {
  if (booted) return
  booted = true
  store.subscribe(persist)
  window.addEventListener('pagehide', () => saveNow())
  onLocation((loc, prev) => {
    if (inSettings(prev) && !inSettings(loc)) {
      tier1.flush(toConfig(store.get())).catch(reportError)
      reloadSettings().catch(reportError)
    }
    store.set((s) => ({
      watching: false,
      visit: onFrontPage(loc) ? s.visit + 1 : s.visit,
      recentHidden: onFrontPage(loc) ? [] : s.recentHidden,
    }))
    // Fresh plays show up at the next front-page visit.
    const lib = store.get().library
    if (
      onFrontPage(loc) &&
      lib &&
      Date.now() - Date.parse(lib.syncedAt) > REFRESH_MS
    )
      refreshLibrary()
  })
  if (onFrontPage()) store.set((s) => ({ visit: s.visit + 1 }))
  // The library loads even if the configuration could not be read: the
  // rows then run on the default settings.
  loadConfig()
    .catch(reportError)
    .then(() => refreshLibrary())
}

// After the plugin changes a record in Stash (a gender, a rating, custom
// fields), it patches its copy of the library so the model sees the change at
// once, without waiting for the next refresh.
function patchLibrary(list, id, fields) {
  store.set((s) => {
    if (!s.library) return null
    const rows = s.library[list].map((r) =>
      r.id === id ? { ...r, ...fields } : r,
    )
    return { library: { ...s.library, [list]: rows } }
  })
}
export const patchLibraryScene = (id, fields) =>
  patchLibrary('scenes', id, fields)
export const patchLibraryPerformer = (id, fields) =>
  patchLibrary('performers', id, fields)
