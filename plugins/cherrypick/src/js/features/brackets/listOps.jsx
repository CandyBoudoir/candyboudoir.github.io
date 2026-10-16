// Bracket and Options beside the list toolbars, and the resume pill under
// them. Stash has no supported slot for either (docs/stash-seams.md), so a
// component added after FilteredPerformerList / FilteredSceneList renders
// them through portals: the pair as the first group inside the toolbar's
// .list-operations, next to Stash's own ⋯ menu, and the pill right under
// the toolbar. That component lives as long as the list does, so the
// buttons stay put while the list reloads. The list's filter comes from
// PerformerList / SceneList, whose props carry it.
//
// Where: the Performers page gets the performer pair; the Scenes page and
// the scenes of a tag, studio or group get the scene pair; a performer's
// Scenes tab gets "Bracket her scenes". No toolbar, no buttons.
import {
  patch,
  patchAfter,
  React,
  ReactDOM,
  ReactRouterDOM,
} from '../../runtime/api.js'
import { createStore, useStoreValue } from '../../runtime/store.js'
import { run, store } from '../../runtime/app.js'
import * as BR from '../../model/brackets.js'
import { watchedPool } from '../../model/bracketSetup.js'
import { pronoun } from '../../model/util.js'
import { describeFilter, listPlace } from '../../data/listFilter.js'
import { useAppState } from '../../ui/hooks.js'
import { Safe } from '../../ui/Safe.jsx'
import {
  openClipSetup,
  openPerformerSetup,
  quickStartClip,
  quickStartPerformers,
} from './actions.js'
import { BracketIcon, ResumePill } from './parts.jsx'

// ------------------------------------------------------------ the list's filter

// The filter each kind of list last rendered with, numbered. Lists report
// during their render, so the store changes a moment later, outside it. A
// list's buttons take only filters reported after their list first
// rendered, never the previous page's.
const lists = createStore({ scene: null, performer: null })
const latest = { scene: null, performer: null }
let seq = 0
function report(kind, filter) {
  if (!filter || latest[kind]?.filter === filter) return
  latest[kind] = { filter, seq: ++seq }
  Promise.resolve().then(() => {
    if (lists.get()[kind] !== latest[kind]) lists.set({ [kind]: latest[kind] })
  })
}

function describe(filter) {
  try {
    return describeFilter(filter)
  } catch (e) {
    console.error('CherryPick: could not read the list filter', e)
    return null
  }
}

// ------------------------------------------------------------ what a filter matches

const PERFORMER_IDS = `
  query CherryPickListPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      performers { id }
    }
  }
`
const SCENE_IDS = `
  query CherryPickListScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
    findScenes(filter: $filter, scene_filter: $scene_filter) {
      scenes { id }
    }
  }
`
const FRESH_MS = 30 * 1000
const matches = new Map()

// The ids a list's filter matches, every page of it: a Set. Kept for a
// little while per filter, so a click right after the list loads is instant.
export function matchIds(kind, desc) {
  const key = kind + '|' + desc.key
  const hit = matches.get(key)
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.ids
  if (matches.size > 20) matches.delete(matches.keys().next().value)
  const filter = { q: desc.q || undefined, per_page: -1 }
  const ids =
    kind === 'performer'
      ? run(PERFORMER_IDS, { filter, performer_filter: desc.criteria }).then(
          (d) => new Set(d.findPerformers.performers.map((p) => p.id)),
        )
      : run(SCENE_IDS, { filter, scene_filter: desc.criteria }).then(
          (d) => new Set(d.findScenes.scenes.map((s) => s.id)),
        )
  ids.catch(() => matches.delete(key))
  matches.set(key, { at: Date.now(), ids })
  return ids
}

function reportError(e) {
  console.error('CherryPick:', e)
  store.set({ error: String(e?.message || e) })
}

// ------------------------------------------------------------ the pairs

function PerformerOps({ desc }) {
  const ready = useAppState((s) => !!s.M)
  const active = useAppState((s) => !!s.brackets.active)
  const key = desc?.key
  React.useEffect(() => {
    if (desc?.active) matchIds('performer', desc).catch(() => {})
    // desc is compared by its key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const withIds = async () =>
    desc?.active ? { ...desc, ids: await matchIds('performer', desc) } : desc
  const go = (fn) => () => withIds().then(fn).catch(reportError)
  return (
    <div className="btn-group cherrypick-bracket-ops">
      {active ? null : (
        <button
          type="button"
          className="btn btn-secondary cherrypick-bracket-button"
          disabled={!ready}
          title={
            desc?.active
              ? 'Bracket the performers in this list'
              : 'Bracket your performers'
          }
          onClick={go(quickStartPerformers)}
        >
          <BracketIcon />
          <span>Bracket</span>
        </button>
      )}
      <button
        type="button"
        className="btn btn-link cherrypick-options-link"
        disabled={!ready}
        onClick={go(openPerformerSetup)}
      >
        Options
      </button>
    </div>
  )
}

// The scenes a scene list's filter matches: all of them when the list is
// unfiltered, a performer's own (known locally) on her Scenes tab, else
// what Stash returns for the filter. null while unknown.
function useListScenes(where, desc, M) {
  const [fetched, setFetched] = React.useState(null)
  const local =
    where.place === 'performer-scenes' && desc && desc.count <= 1 && !desc.q
  const remote = !!desc?.active && !local
  const key = desc?.key
  React.useEffect(() => {
    setFetched(null)
    if (!remote) return
    let live = true
    matchIds('scene', desc).then(
      (ids) => live && setFetched({ key, ids }),
      (e) => live && reportError(e),
    )
    return () => {
      live = false
    }
    // desc is compared by its key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, remote])
  if (!desc || !M) return null
  if (!desc.active) return watchedPool(M.db, null)
  if (local) {
    const p = M.db.performers.get(where.performerId)
    return watchedPool(M.db, new Set(p?.ownedSceneIds || []))
  }
  return fetched?.key === key ? watchedPool(M.db, fetched.ids) : null
}

const cap = (s) => s[0].toUpperCase() + s.slice(1)

function SceneOps({ where, desc, pathname }) {
  const M = useAppState((s) => s.M)
  const active = useAppState((s) => !!s.brackets.active)
  const ids = useListScenes(where, desc, M)
  const n = ids ? ids.length : null
  const ok = n != null && n >= BR.MIN_CLIP_POOL
  let pool
  let label
  let title
  if (where.place === 'performer-scenes') {
    const p = M?.db.performers.get(where.performerId)
    // A performer with no watched scenes shows no button
    if (!p || !n) return null
    const her = pronoun(p)
    pool = {
      ids,
      poolLabel: `${p.name}'s scenes`,
      poolNote: `${cap(her)} scenes you've watched`,
      short: `Watch ${BR.MIN_CLIP_POOL - n} more of ${her} scenes to bracket them.`,
      origin: pathname,
    }
    label = `Bracket ${her} scenes`
    title = ok
      ? `A bracket of ${BR.clipPoolPhrase(n)} scenes of ${her} you've watched`
      : `Needs ${BR.MIN_CLIP_POOL} watched scenes; you've watched ${n}`
  } else {
    pool = {
      ids: ids || [],
      poolLabel: desc?.active
        ? desc.fullLabel || 'This list'
        : 'All watched scenes',
      poolNote: 'The watched scenes in this list',
      short: "Widen this list's filter to take in more of them.",
      origin: pathname,
    }
    label = 'Bracket'
    title =
      n == null
        ? undefined
        : ok
          ? `Bracket ${BR.clipPoolPhrase(n)} watched scenes in this list`
          : `Needs ${BR.MIN_CLIP_POOL} watched scenes in this list`
  }
  const herTab = where.place === 'performer-scenes'
  return (
    <div className="btn-group cherrypick-bracket-ops">
      {active && !herTab ? null : (
        <button
          type="button"
          className="btn btn-secondary cherrypick-bracket-button"
          disabled={n == null || (herTab && active)}
          title={title}
          onClick={() => quickStartClip(pool)}
        >
          <BracketIcon />
          <span>{label}</span>
        </button>
      )}
      <button
        type="button"
        className="btn btn-link cherrypick-options-link"
        disabled={n == null}
        onClick={() => openClipSetup(pool)}
      >
        Options
      </button>
    </div>
  )
}

// ------------------------------------------------------------ the portals

const findRoot = (anchor) => {
  const prev = anchor?.previousElementSibling
  if (prev?.classList.contains('item-list-container')) return prev
  return anchor?.parentElement?.querySelector('.item-list-container') || null
}

// Two elements of Cherry Pick's own inside Stash's list: the pair's slot,
// first in the toolbar's .list-operations, and the pill's, right under the
// toolbar. Put back if Stash re-renders them away.
function useToolbarSlots(anchor, enabled) {
  const [slots, setSlots] = React.useState(null)
  React.useLayoutEffect(() => {
    const host = anchor.current?.parentElement
    if (!enabled || !host) return
    const ops = document.createElement('div')
    ops.className = 'cherrypick-bracket-slot cherrypick-ui'
    const pill = document.createElement('div')
    pill.className = 'cherrypick-pill-slot cherrypick-ui'
    const place = () => {
      const toolbar = findRoot(anchor.current)?.querySelector(
        '.filtered-list-toolbar',
      )
      const target = toolbar?.querySelector(':scope > .list-operations')
      if (!target) return
      if (target.firstChild !== ops) target.insertBefore(ops, target.firstChild)
      if (toolbar.nextElementSibling !== pill) toolbar.after(pill)
    }
    const inPlace = () =>
      ops.isConnected &&
      ops.parentElement.firstChild === ops &&
      pill.previousElementSibling?.classList.contains('filtered-list-toolbar')
    place()
    const watch = new MutationObserver(() => inPlace() || place())
    watch.observe(host, { childList: true, subtree: true })
    setSlots({ ops, pill })
    return () => {
      watch.disconnect()
      ops.remove()
      pill.remove()
    }
  }, [anchor, enabled])
  return enabled ? slots : null
}

function ListBracket({ kind, since: listStart }) {
  const { pathname } = ReactRouterDOM.useLocation()
  const where = listPlace(kind, pathname)
  const [since] = React.useState(listStart)
  const entry = useStoreValue(lists, (s) => s[kind])
  const filter = entry && entry.seq > since ? entry.filter : null
  const desc = React.useMemo(() => (filter ? describe(filter) : null), [filter])
  const anchor = React.useRef(null)
  const slots = useToolbarSlots(anchor, !!where)
  if (!where) return null
  return (
    <>
      <span ref={anchor} hidden />
      {slots
        ? ReactDOM.createPortal(
            <Safe name="bracket buttons">
              {kind === 'performer' ? (
                <PerformerOps desc={desc} />
              ) : (
                <SceneOps where={where} desc={desc} pathname={pathname} />
              )}
            </Safe>,
            slots.ops,
          )
        : null}
      {slots && where.place !== 'performer-scenes'
        ? ReactDOM.createPortal(
            <Safe name="resume pill">
              <ResumePill />
            </Safe>,
            slots.pill,
          )
        : null}
    </>
  )
}

export function registerListOps() {
  patch.before('PerformerList', (...args) => {
    report('performer', args[0]?.filter)
    return args
  })
  patch.before('SceneList', (...args) => {
    report('scene', args[0]?.filter)
    return args
  })
  patchAfter('FilteredPerformerList', (props, result) => (
    <>
      {result}
      <Safe name="performer bracket buttons">
        <ListBracket kind="performer" since={seq} />
      </Safe>
    </>
  ))
  patchAfter('FilteredSceneList', (props, result) => (
    <>
      {result}
      <Safe name="scene bracket buttons">
        <ListBracket kind="scene" since={seq} />
      </Safe>
    </>
  ))
}
