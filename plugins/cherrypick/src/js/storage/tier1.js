// Tier 1: the plugin's configuration map, kept by Stash in config.yml with
// configurePlugin and the same in every browser. It holds the settings, the
// remembered bracket choice, Not interested, Don't learn, the bracket in
// progress, the Hall of Fame, applied-rating batches, consent, the answer
// to the offer beside Stash Curator, the auto-apply default last written,
// Watch This's snoozes and the bracket map's size: a few KB, the snoozes at
// most 300 entries.
//
// Two Stash behaviours shape it:
//   - configurePlugin replaces the plugin's whole map, so every write is
//     read-modify-write.
//   - Stash's Settings page loads the configuration when it opens and, on any
//     toggle, writes back the copy it loaded. A value the plugin wrote while
//     that page was open would be lost, so the plugin's writes wait until the
//     user leaves Settings, then land on top.
//   - Stash 0.30.0 to 0.31.1 can freeze until restarted when a write meets
//     a request that reads its SFW setting (docs/stash-seams.md). Each write
//     waits for the page to settle (io.settle), changes made meanwhile go out
//     with it, and a write that would change nothing is not sent.
// A mirror of the map lives in browser storage. On load, a missing map is
// restored from it, and a map older than the mirror gets the plugin's data
// keys back while keeping the settings Stash wrote.
//
// Each data key holds one JSON string. Stash keeps nested maps, but numbers
// inside arrays come back as strings after a restart (its YAML writer has no
// case for them), and a string round-trips exactly.
import { SETTING_DEFAULTS, SETTING_KEYS } from './settings.js'

// Keys the plugin itself writes (the settings are written by Stash's page).
export const DATA_KEYS = [
  'bracketPrefs',
  'notInterested',
  'dontLearn',
  'bracket',
  'hallOfFame',
  'applied',
  'consent',
  'curatorOffer',
  'autoApplyDefault',
  'snoozes',
  'mapSize',
]
export const ALL_KEYS = [...SETTING_KEYS, ...DATA_KEYS]

// A data key's value: JSON text, or (from an older or hand-edited map) the
// value itself. Unreadable text counts as missing.
function decode(v) {
  if (typeof v !== 'string') return v ?? null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}
const encode = (v) => (v == null ? null : JSON.stringify(v))

// The map, as the plugin's state reads it.
export function fromConfig(map) {
  const m = map || {}
  const settings = { ...SETTING_DEFAULTS }
  for (const k of SETTING_KEYS) if (m[k] != null) settings[k] = m[k]
  return {
    settings,
    bracketPrefs: decode(m.bracketPrefs),
    notInterested: decode(m.notInterested) || [],
    dontLearn: decode(m.dontLearn) || [],
    brackets: {
      active: decode(m.bracket),
      history: decode(m.hallOfFame) || [],
    },
    applied: decode(m.applied) || [],
    consent: decode(m.consent) || { stashdb: null },
    // 'hide' or 'keep' once the user answered (model/curator.js)
    curatorOffer: decode(m.curatorOffer),
    // the autoApply value Cherry Pick last wrote (autoApplyToWrite)
    autoApplyDefault: decode(m.autoApplyDefault),
    // Watch This's skipped and ignored scenes (model/watch.js Snooze)
    snoozes: decode(m.snoozes) || [],
    // the bracket map's size, 'line', 'short' or 'tall' (map/stage.jsx);
    // null until the user picks one, which reads as tall
    mapSize: decode(m.mapSize),
  }
}

// The plugin's state, as the map stores it.
export function toConfig(s) {
  return {
    ...Object.fromEntries(SETTING_KEYS.map((k) => [k, s.settings[k]])),
    bracketPrefs: encode(s.bracketPrefs),
    notInterested: encode(s.notInterested),
    dontLearn: encode(s.dontLearn),
    bracket: encode(s.brackets.active),
    hallOfFame: encode(s.brackets.history),
    applied: encode(s.applied),
    consent: encode(s.consent),
    curatorOffer: encode(s.curatorOffer),
    autoApplyDefault: encode(s.autoApplyDefault),
    snoozes: encode(s.snoozes),
    mapSize: encode(s.mapSize),
  }
}

// Which config keys each piece of plugin state lands in.
export const STATE_TO_CONFIG = {
  bracketPrefs: ['bracketPrefs'],
  notInterested: ['notInterested'],
  dontLearn: ['dontLearn'],
  brackets: ['bracket', 'hallOfFame'],
  applied: ['applied'],
  consent: ['consent'],
  curatorOffer: ['curatorOffer'],
  snoozes: ['snoozes'],
  mapSize: ['mapSize'],
}

// The map Stash's Settings page saves when the Curator offer is answered
// there: that page's own copy, with the answer and the settings it changes.
// The page writes its copy back on every toggle, so the answer goes through
// it rather than past it.
export const withCuratorAnswer = (map, answer, settings) => ({
  ...map,
  ...settings,
  curatorOffer: encode(answer),
})

/**
 * @param {{
 *   read: () => Promise<object|null>,      // this plugin's map from Stash
 *   write: (map: object) => Promise<void>, // configurePlugin
 *   mirror: { get: () => object|null, set: (map: object) => void, del: () => void },
 *   settingsOpen: () => boolean,
 *   settle?: () => Promise<void>,          // resolves when a write is safe
 *   now?: () => string,
 *   log?: (text: string) => void,
 * }} io
 */
export function createTier1(io) {
  const now = io.now || (() => new Date().toISOString())
  const log = io.log || (() => {})
  const settle = io.settle || (() => Promise.resolve())
  const pending = new Set()
  const pendingOwn = new Set()
  let pendingFull = null
  let chain = Promise.resolve()

  // Writes run one at a time, so two read-modify-writes never interleave.
  const serial = (fn) => (chain = chain.then(fn, fn))

  // The map and the mirror are stamped in the order things happen in this
  // tab, never twice alike, so a change staged after a save took its copy
  // always reads as newer than what that save writes.
  let lastStamp = ''
  const stamp = () => {
    const t = now()
    lastStamp =
      t > lastStamp ? t : new Date(Date.parse(lastStamp) + 1).toISOString()
    return lastStamp
  }
  // When each key last changed (stage)
  const stagedAt = {}

  // at: the stamp taken with full, so the map is as old as its copy.
  // own: settings among keys the user changed through the plugin itself,
  // which are written over Stash's value.
  async function readModifyWrite(full, keys, own, at) {
    const cur = await io.read()
    const mirror = io.mirror.get()
    const stale =
      !!cur && !!mirror?.updatedAt && (cur.updatedAt || '') < mirror.updatedAt
    const write = new Set(
      !cur || cur.removedAt ? ALL_KEYS : stale ? [...DATA_KEYS, ...keys] : keys,
    )
    // After a removal the map starts empty but keeps its tombstone, so
    // another browser's older mirror still cannot bring old data back.
    const next =
      cur && !cur.removedAt
        ? { ...cur }
        : cur?.removedAt
          ? { removedAt: cur.removedAt }
          : {}
    // Settings are Stash's to write: the plugin only fills in one the map
    // lacks (the defaults, or a map restored from the mirror), or one the
    // user changed through the plugin (own). A deferred write that carried
    // the plugin's older copy would otherwise undo a switch the user just
    // turned on Stash's Settings page.
    const stashOwns = (k) =>
      SETTING_KEYS.includes(k) &&
      !own.includes(k) &&
      !!cur &&
      !cur.removedAt &&
      cur[k] != null
    for (const k of write)
      if (full[k] !== undefined && !stashOwns(k)) next[k] = full[k]
    // A map that already holds every value needs no write: the mirror takes
    // the map's stamp instead, so the next load does not read it as stale.
    const same = (k) => (next[k] ?? null) === (cur?.[k] ?? null)
    const changed =
      !cur || Object.keys(next).some((k) => k !== 'updatedAt' && !same(k))
    if (changed) {
      next.updatedAt = at
      await io.write(next)
    }
    // A change staged while this write was out is newer than the copy it
    // carried, so the mirror keeps it, still newer than the map, until its
    // own save lands. Should the page be left or the tab closed before
    // then, the next load restores the change rather than what it replaced
    // (an abandoned bracket came back as "Resume bracket").
    const later = Object.keys(stagedAt).filter((k) => stagedAt[k] > at)
    const staged = io.mirror.get()
    io.mirror.set(
      later.length && staged
        ? {
            ...next,
            ...Object.fromEntries(later.map((k) => [k, staged[k]])),
            updatedAt: staged.updatedAt,
          }
        : next,
    )
    log(
      !changed
        ? `no configurePlugin: the map already holds ${[...keys].join(', ')}`
        : !cur
          ? 'configurePlugin: the map was missing; wrote back everything'
          : stale
            ? "configurePlugin: the map was stale; wrote back the plugin's data"
            : `configurePlugin: ${[...keys].join(', ')}`,
    )
    return changed ? 'written' : 'unchanged'
  }

  // The write waiting for the page to settle. A save made meanwhile joins
  // it with its newer copy, so a burst of changes is one write.
  let batch = null
  function enqueue(full, keys, own) {
    const at = stamp()
    if (batch) {
      keys.forEach((k) => batch.keys.add(k))
      own.forEach((k) => batch.own.add(k))
      Object.assign(batch, { full, at })
      return batch.done
    }
    const b = { full, keys: new Set(keys), own: new Set(own), at }
    batch = b
    b.done = serial(async () => {
      await settle()
      // dropped by remove
      if (batch !== b) return 'none'
      batch = null
      return readModifyWrite(b.full, [...b.keys], [...b.own], b.at)
    })
    return b.done
  }

  return {
    // full: the whole map from the plugin's state; keys: what changed;
    // own: settings among them the user changed through the plugin itself
    // (Hide on cards, off Stash's Settings page), written over Stash's.
    save(full, keys, own = []) {
      if (!keys.length) return Promise.resolve('none')
      if (io.settingsOpen()) {
        keys.forEach((k) => pending.add(k))
        own.forEach((k) => pendingOwn.add(k))
        pendingFull = full
        log(`deferred ${keys.join(', ')}: Stash's Settings page is open`)
        return Promise.resolve('deferred')
      }
      return enqueue(full, keys, own)
    },

    // Call when the user leaves Stash's Settings page.
    flush(full) {
      if (!pending.size) return Promise.resolve('none')
      const keys = [...pending]
      const own = [...pendingOwn]
      const map = full || pendingFull
      pending.clear()
      pendingOwn.clear()
      pendingFull = null
      return enqueue(map, keys, own)
    },

    pending: () => [...pending],

    // Records a change in the mirror at once, ahead of a debounced save, so
    // a tab closed before the save still has it at the next load (the
    // mirror is then newer than Stash's map, and load restores it).
    stage(full, keys) {
      const next = { ...(io.mirror.get() || {}) }
      next.updatedAt = stamp()
      for (const k of keys)
        if (full[k] !== undefined) {
          next[k] = full[k]
          stagedAt[k] = next.updatedAt
        }
      io.mirror.set(next)
    },

    // The map to start from, and whether it came back from the mirror
    // ('missing' or 'stale'), in which case the caller writes it back.
    // read: the map, when the caller already has it (null when Stash holds
    // none); without it, load reads it.
    async load(read) {
      const cur = read === undefined ? await io.read() : read
      const mirror = io.mirror.get()
      if (cur?.removedAt && cur.removedAt >= (mirror?.updatedAt || '')) {
        // The plugin's data was removed after this browser last wrote: its
        // mirror is void, and the map holds only what came after.
        io.mirror.del()
        return { map: cur, restored: null }
      }
      if (!mirror) {
        if (cur && !cur.removedAt) io.mirror.set(cur)
        return { map: cur, restored: null }
      }
      if (!cur) return { map: { ...mirror }, restored: 'missing' }
      const stale = (cur.updatedAt || '') < (mirror.updatedAt || '')
      const lost = DATA_KEYS.filter((k) => mirror[k] != null && cur[k] == null)
      if (stale || lost.length) {
        const map = { ...cur }
        for (const k of stale ? DATA_KEYS : lost) map[k] = mirror[k]
        return { map, restored: stale ? 'stale' : 'missing' }
      }
      return { map: cur, restored: null }
    },

    // "Remove Cherry Pick data": a tombstone stops other browsers' mirrors
    // from bringing the data back.
    async remove() {
      batch = null
      await serial(async () => {
        await settle()
        await io.write({ removedAt: now() })
        io.mirror.del()
      })
    },
  }
}
