// Tier 3: browser storage, only for what can be rebuilt from Stash's records:
// the library copy and the taste model (IndexedDB, too big for
// localStorage), For you's row signals, the StashDB cache and the tier 1
// mirror. A private window or full storage degrades to no persistence.
import { clear, createStore, del, get, set } from 'idb-keyval'
import { PLUGIN_ID, STORAGE_PREFIX } from '../name.js'

export const KEYS = {
  mirror: STORAGE_PREFIX + 'config-mirror',
  signals: STORAGE_PREFIX + 'for-you-signals',
  stashdb: STORAGE_PREFIX + 'stashdb-cache',
}

export const local = {
  get(key) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // private mode or full: run without persistence
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // nothing to remove
    }
  },
}

let idb = null
const db = () => (idb ||= createStore(PLUGIN_ID.toLowerCase(), 'cache'))

// IndexedDB through idb-keyval; every call fails soft.
export const cache = {
  get: (key) => get(key, db()).catch(() => null),
  set: (key, value) => set(key, value, db()).catch(() => {}),
  del: (key) => del(key, db()).catch(() => {}),
}

// "Remove Cherry Pick data" and "Open on a new device": everything here goes.
export async function clearTier3() {
  for (const key of Object.values(KEYS)) local.del(key)
  await clear(db()).catch(() => {})
}
