// The For you tab on Cherry Pick's page: every scene For you would show, in
// its order, through Stash's own SceneList, so Grid, List and Wall are
// Stash's, with every plugin's card patches and the theme's look. The tab
// starts with the front page's row as this visit showed it (snapshot in
// frontPage.jsx), then the rest of the ranking (forYouList). Quick filters
// narrow it to a pool, ranked afresh. The order holds still for the visit.
//
// The view, the page and the filters live in the address, so Back from a
// scene comes back to the same place; the view and zoom are also kept in
// this browser for the next visit. A card opened counts as For you's
// "opened" signal; passing cards here counts for nothing.
import {
  Bootstrap,
  components,
  FontAwesomeSolid,
  hooks,
  React,
  ReactRouterDOM,
} from '../runtime/api.js'
import { recordOpen } from '../runtime/actions.js'
import { context, forYouList, reasonFor } from '../model/foryou.js'
import { BuildingLine } from '../ui/BuildingLine.jsx'
import { PageItems } from '../ui/rowCards.jsx'
import { useStashRecords } from '../ui/records.js'
import { useAppState } from '../ui/hooks.js'
import { KEYS, local } from '../storage/tier3.js'
import { snapshot } from './frontPage.jsx'

const { Button, ButtonGroup, Form } = Bootstrap
const { faList, faSquare, faThLarge } = FontAwesomeSolid
const { useHistory, useLocation } = ReactRouterDOM
const { loadableComponents } = window.PluginApi

// Stash's DisplayMode (models/list-filter/types.ts)
const VIEWS = [
  { mode: 0, title: 'Grid', icon: faThLarge },
  { mode: 1, title: 'List', icon: faList },
  { mode: 2, title: 'Wall', icon: faSquare },
]
const PER_PAGE = [20, 40, 60, 120]
const LENGTHS = {
  short: { label: 'Under 10 min', fits: (d) => d != null && d < 600 },
  mid: {
    label: '10 to 30 min',
    fits: (d) => d != null && d >= 600 && d <= 1800,
  },
  long: { label: 'Over 30 min', fits: (d) => d != null && d > 1800 },
}
const ROW_ID = 'foryou-tab'

// SceneList and the pickers register once their modules load
const NEEDED = [
  loadableComponents.Scenes,
  loadableComponents.SceneList,
  loadableComponents.SceneCard,
]

// ------------------------------------------------------------ the address

const ids = (v) => (v ? v.split(',').filter(Boolean) : [])

function readParams(search) {
  const p = new URLSearchParams(search)
  const kept = local.get(KEYS.forYouView) || {}
  const num = (k, def) => (p.has(k) ? Number(p.get(k)) : def)
  return {
    disp: num('disp', kept.disp ?? 0),
    z: num('z', kept.z ?? 1),
    page: Math.max(1, num('p', 1)),
    per: num('per', kept.per ?? 40),
    q: p.get('q') || '',
    performers: ids(p.get('performers')),
    studios: ids(p.get('studios')),
    tags: ids(p.get('tags')),
    unwatched: p.get('unwatched') === '1',
    length: LENGTHS[p.get('length')] ? p.get('length') : '',
  }
}

function writeParams(v) {
  const p = new URLSearchParams()
  p.set('disp', v.disp)
  if (v.disp !== 1) p.set('z', v.z)
  if (v.page > 1) p.set('p', v.page)
  p.set('per', v.per)
  if (v.q) p.set('q', v.q)
  if (v.performers.length) p.set('performers', v.performers.join(','))
  if (v.studios.length) p.set('studios', v.studios.join(','))
  if (v.tags.length) p.set('tags', v.tags.join(','))
  if (v.unwatched) p.set('unwatched', '1')
  if (v.length) p.set('length', v.length)
  return '?' + p.toString()
}

const filtered = (v) =>
  !!(
    v.q ||
    v.performers.length ||
    v.studios.length ||
    v.tags.length ||
    v.unwatched ||
    v.length
  )

// The owned scenes the quick filters let through, by id: any of the
// performers, the studios or their sub-studios, all of the tags, and every
// word of the search in the title or a performer, studio or tag name.
function poolOf(db, v) {
  const words = v.q.toLowerCase().split(/\s+/).filter(Boolean)
  const perf = new Set(v.performers)
  const studios = new Set(v.studios)
  const tags = v.tags
  const len = LENGTHS[v.length]
  const pool = new Set()
  for (const s of db.owned) {
    if (perf.size && !s.performers.some((p) => perf.has(p.id))) continue
    if (
      studios.size &&
      !(
        s.studio &&
        (studios.has(s.studio.id) || studios.has(s.studio.parent?.id))
      )
    )
      continue
    if (tags.length && !tags.every((t) => s.tags.some((x) => x.id === t)))
      continue
    if (v.unwatched && s.local.play_count > 0) continue
    if (len && !len.fits(s.duration)) continue
    if (words.length) {
      const text = [
        s.title,
        s.studio?.name,
        ...s.performers.map((p) => p.name),
        ...s.tags.map((t) => t.name),
      ]
        .join(' ')
        .toLowerCase()
      if (!words.every((w) => text.includes(w))) continue
    }
    pool.add(s.id)
  }
  return pool
}

// ------------------------------------------------------------ the queue

// Stash's SceneList wants a ListFilterModel, which plugins cannot make. It
// reads the display mode and zoom, and builds the play queue from a clone:
// itemsPerPage, currentPage and getEncodedParams. That queue would point at
// Stash's whole scene list, so the tab sends a card's click to the player
// with For you's own order instead (onOpenCard).
function standIn(v) {
  const f = {
    displayMode: v.disp,
    zoomIndex: v.z,
    currentPage: v.page,
    itemsPerPage: v.per,
    getEncodedParams: () => ({}),
    clone: () => ({ ...f }),
  }
  return f
}

// The scene a click inside the list opens: a card's or a row's link, or a
// wall item, whose picture is the scene's preview or screenshot.
function clickedScene(target) {
  const a = target.closest('a[href]')
  if (a) return a.getAttribute('href').match(/^\/scenes\/(\d+)/)?.[1] || null
  const item = target.closest('.wall-item')
  const src = item?.querySelector('video, img')?.getAttribute('src') || ''
  return src.match(/\/scene\/(\d+)\//)?.[1] || null
}

const queueLink = (id, order) =>
  `/scenes/${id}?${order.map((x) => `qs=${x}`).join('&')}`

// ------------------------------------------------------------ the toolbar

function Pickers({ v, set, db }) {
  const { PerformerSelect, StudioSelect, TagSelect } = components
  const named = (map, list, extra) =>
    list.map((id) => ({
      id,
      name: map.get(id)?.name || id,
      ...extra,
    }))
  const studioById = new Map(
    db.owned.filter((s) => s.studio).map((s) => [s.studio.id, s.studio]),
  )
  const tagById = new Map(db.owned.flatMap((s) => s.tags.map((t) => [t.id, t])))
  const pick = (key) => (items) => set({ [key]: items.map((i) => i.id) })
  return (
    <>
      {PerformerSelect ? (
        <PerformerSelect
          isMulti
          className="cherrypick-fy-pick"
          noSelectionString="Performers"
          values={named(db.performers, v.performers, { alias_list: [] })}
          onSelect={pick('performers')}
        />
      ) : null}
      {StudioSelect ? (
        <StudioSelect
          isMulti
          className="cherrypick-fy-pick"
          noSelectionString="Studios"
          values={named(studioById, v.studios, { aliases: [] })}
          onSelect={pick('studios')}
        />
      ) : null}
      {TagSelect ? (
        <TagSelect
          isMulti
          className="cherrypick-fy-pick"
          noSelectionString="Tags"
          values={named(tagById, v.tags, { aliases: [] })}
          onSelect={pick('tags')}
        />
      ) : null}
    </>
  )
}

// The first line: the search, the pickers, Unwatched and the length. On a
// phone the pickers fold behind a Filters button beside the search.
function Filters({ v, set, db }) {
  const [open, setOpen] = React.useState(false)
  const on =
    v.performers.length +
    v.studios.length +
    v.tags.length +
    (v.unwatched ? 1 : 0) +
    (v.length ? 1 : 0)
  const [q, setQ] = React.useState(v.q)
  React.useEffect(() => setQ(v.q), [v.q])
  React.useEffect(() => {
    if (q === v.q) return
    const t = setTimeout(() => set({ q }), 300)
    return () => clearTimeout(t)
  }, [q, v.q, set])
  return (
    <div className="cherrypick-fy-filters">
      <Form.Control
        className="cherrypick-fy-search text-input"
        placeholder="Search For you"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button
        variant="secondary"
        active={open}
        className="cherrypick-fy-more-toggle"
        onClick={() => setOpen(!open)}
      >
        Filters{on ? ` (${on})` : ''}
      </Button>
      <div className={`cherrypick-fy-more${open ? ' open' : ''}`}>
        <Pickers v={v} set={set} db={db} />
        <Button
          variant="secondary"
          active={v.unwatched}
          className="cherrypick-fy-unwatched"
          onClick={() => set({ unwatched: !v.unwatched })}
        >
          Unwatched
        </Button>
        <Form.Control
          as="select"
          className="cherrypick-fy-length btn-secondary"
          value={v.length}
          onChange={(e) => set({ length: e.target.value })}
        >
          <option value="">Any length</option>
          {Object.entries(LENGTHS).map(([k, l]) => (
            <option key={k} value={k}>
              {l.label}
            </option>
          ))}
        </Form.Control>
      </div>
      {filtered(v) ? (
        <Button
          variant="link"
          className="cherrypick-fy-clear"
          onClick={() =>
            set({
              q: '',
              performers: [],
              studios: [],
              tags: [],
              unwatched: false,
              length: '',
            })
          }
        >
          Clear
        </Button>
      ) : null}
    </div>
  )
}

// The second line, as Stash's lists have it: where the page is, the pages,
// and the view (page size, Grid, List or Wall, card size). The bottom of
// the list repeats the pages alone.
function ViewBar({ v, set, total, setPage }) {
  const { Icon, Pagination, PaginationIndex } = components
  return (
    <div className="cherrypick-fy-viewbar">
      <div className="cherrypick-fy-index">
        {PaginationIndex ? (
          <PaginationIndex
            itemsPerPage={v.per}
            currentPage={v.page}
            totalItems={total}
          />
        ) : null}
      </div>
      {Pagination ? (
        <Pagination
          itemsPerPage={v.per}
          currentPage={v.page}
          totalItems={total}
          onChangePage={setPage}
        />
      ) : null}
      <div className="cherrypick-fy-view">
        <Form.Control
          as="select"
          className="cherrypick-fy-per btn-secondary"
          title="Scenes on a page"
          value={v.per}
          onChange={(e) => set({ per: Number(e.target.value) }, true)}
        >
          {PER_PAGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Form.Control>
        <ButtonGroup className="cherrypick-fy-modes">
          {VIEWS.map((m) => (
            <Button
              key={m.mode}
              variant="secondary"
              title={m.title}
              active={v.disp === m.mode}
              onClick={() => set({ disp: m.mode }, true)}
            >
              <Icon icon={m.icon} />
            </Button>
          ))}
        </ButtonGroup>
        {v.disp !== 1 ? (
          <Form.Control
            className="zoom-slider cherrypick-fy-zoom"
            type="range"
            min={0}
            max={3}
            title="Card size"
            value={v.z}
            onChange={(e) => set({ z: Number(e.target.value) }, true)}
          />
        ) : null}
      </div>
    </div>
  )
}

function Pages({ v, total, setPage }) {
  const { Pagination } = components
  return (
    <div className="cherrypick-fy-pages">
      {Pagination ? (
        <Pagination
          itemsPerPage={v.per}
          currentPage={v.page}
          totalItems={total}
          onChangePage={setPage}
        />
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------ the tab

export function ForYouTab() {
  const s = useAppState((x) => x)
  const hidden = useAppState((x) => x.notInterested)
  const loading = hooks.useLoadComponents(NEEDED)
  const location = useLocation()
  const history = useHistory()
  const v = readParams(location.search)
  const snap = snapshot(s)

  const set = React.useCallback(
    (changes, view) => {
      const next = { ...readParams(history.location.search), ...changes }
      // a new filter starts at the first page; the view keeps its place
      if (!view && !('page' in changes)) next.page = 1
      if (view)
        local.set(KEYS.forYouView, {
          disp: next.disp,
          z: next.z,
          per: next.per,
        })
      history.replace(history.location.pathname + writeParams(next))
    },
    [history],
  )
  const setPage = (page) => {
    history.push(
      history.location.pathname +
        writeParams({ ...readParams(history.location.search), page }),
    )
    window.scrollTo(0, 0)
  }

  const poolKey = filtered(v)
    ? JSON.stringify([
        v.q,
        v.performers,
        v.studios,
        v.tags,
        v.unwatched,
        v.length,
      ])
    : ''
  const list = React.useMemo(() => {
    if (!snap) return null
    if (snap.fallback) return { items: snap.fallback, ctx: null }
    const ctx = context(s.M, s)
    const pool = poolKey ? poolOf(s.M.db, v) : null
    return {
      ctx,
      items: forYouList(
        ctx,
        snap.signals,
        pool ? { pool } : { row: snap.forYou },
      ),
    }
    // the list holds still for the visit and the filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, poolKey])

  const gone = new Set(hidden.map((n) => n.sceneId))
  const items = list ? list.items.filter((it) => !gone.has(it.scene.id)) : []
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / v.per))
  const page = Math.min(v.page, pages)
  const pageItems = items.slice((page - 1) * v.per, page * v.per)
  const records = useStashRecords(
    'scene',
    pageItems.map((it) => it.scene.id),
  )
  const order = (records || []).map((r) => r.id)
  const byId = React.useMemo(
    () =>
      new Map(
        pageItems.map((it) => [
          it.scene.id,
          {
            ...it,
            reason:
              it.reason ??
              (list?.ctx && it.x ? reasonFor(list.ctx, it.x) : null),
          },
        ]),
      ),
    // pageItems follow the page and the list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, page, v.per, hidden],
  )

  const onClickCapture = (e) => {
    const id = clickedScene(e.target)
    if (!id || !byId.has(id)) return
    recordOpen(id)
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    e.preventDefault()
    e.stopPropagation()
    history.push(queueLink(id, order))
  }

  if (!snap)
    return (
      <div className="cherrypick-fy">
        <BuildingLine />
      </div>
    )
  const { SceneList } = components
  return (
    <div className="cherrypick-fy">
      {snap.fallback ? (
        <p className="text-muted">
          For you starts at 30 scenes. Until then, here is what&apos;s new in
          your library.
        </p>
      ) : null}
      {snap.fallback ? null : (
        <Filters v={{ ...v, page }} set={set} db={s.M.db} />
      )}
      <ViewBar v={{ ...v, page }} set={set} total={total} setPage={setPage} />
      {loading || !SceneList || !records ? (
        <div className="cherrypick-fy-loading">
          <components.LoadingIndicator />
        </div>
      ) : !records.length ? (
        <p className="text-muted cherrypick-fy-empty">
          {filtered(v)
            ? 'No scene For you would show fits these filters.'
            : 'Every scene is marked Not interested or has a tag from Tags to keep out of my picks.'}
        </p>
      ) : (
        <PageItems.Provider value={{ rowId: ROW_ID, items: byId }}>
          <div className="cherrypick-fy-list" onClickCapture={onClickCapture}>
            <SceneList
              scenes={records}
              filter={standIn({ ...v, page })}
              selectedIds={new Set()}
              onSelectChange={() => {}}
            />
          </div>
        </PageItems.Provider>
      )}
      <Pages v={{ ...v, page }} total={total} setPage={setPage} />
    </div>
  )
}
