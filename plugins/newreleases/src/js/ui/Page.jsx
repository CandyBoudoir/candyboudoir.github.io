// The New Releases page, at /plugins/newreleases. It shows the catalog the
// task keeps at once, starts the task when the catalog is a day old (or a
// studio was favourited since), and fills in as the task saves each studio.
// Loading waits behind Suspense boundaries with Stash's own loader: the
// stash-boxes, favourites and catalog first, then the user's tags,
// performers and scenes that name and mark the releases.
import { Bootstrap, React, ReactRouterDOM } from '../api.js'
import { ago, linkedStudios, problems, shouldStart } from '../data/catalog.js'
import {
  applyFilters,
  formatFilters,
  optionsOf,
  parseFilters,
} from '../data/filters.js'
import {
  ownedIndex,
  performerIndex,
  presentReleases,
  tagIndex,
} from '../data/match.js'
import { forget, read } from '../data/resource.js'
import {
  findJob,
  heldScenes,
  loadCatalog,
  loadLibrary,
  loadSetup,
  queuedCheck,
  startCheck,
} from '../data/stash.js'
import { PLUGIN_NAME } from '../name.js'
import { Loading } from './Loading.jsx'
import { ReleaseCard } from './ReleaseCard.jsx'
import { Safe } from './Safe.jsx'
import { Toolbar } from './Toolbar.jsx'

const { Button } = Bootstrap
const { Link, useHistory, useLocation } = ReactRouterDOM

// Cards per step of Show more.
const STEP = 60
// How often the page reads the catalog again while the task runs.
const POLL = 2500
const DONE = new Set(['FINISHED', 'FAILED', 'CANCELLED'])

// ------------------------------------------------------------ the check

// The catalog as the task saves it, and the check: the one already in
// Stash's job queue, or one this visit starts when the catalog is due.
function useChecks(visit, setup, first) {
  const [catalog, setCatalog] = React.useState(first.catalog)
  const [check, setCheck] = React.useState(
    first.job ? { id: first.job.id, running: true } : { running: false },
  )
  const started = React.useRef(false)
  const { linked } = linkedStudios(setup.favourites, setup.boxes)
  const due =
    !started.current &&
    shouldStart({ catalog: first.catalog, linked, queued: !!first.job })

  React.useEffect(() => {
    if (!due || started.current) return
    started.current = true
    startCheck()
      .then((id) => setCheck({ id, running: true }))
      .catch((e) => setCheck({ running: false, error: e.message }))
  }, [due])

  React.useEffect(() => {
    if (!check.running) return
    let live = true
    let timer = null
    const tick = async () => {
      try {
        const [next, job] = await Promise.all([
          loadCatalog(),
          check.id ? findJob(check.id) : queuedCheck(),
        ])
        if (!live) return
        if (next) setCatalog(next)
        if (!job || DONE.has(job.status)) {
          setCheck({
            running: false,
            error: job?.status === 'FAILED' ? job.error || 'failed' : null,
          })
          return
        }
      } catch {
        // the next tick tries again
      }
      if (live) timer = setTimeout(tick, POLL)
    }
    timer = setTimeout(tick, POLL)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [check.running, check.id, visit])

  return { catalog, check }
}

// ------------------------------------------------------------ status

function sourcesText(catalog) {
  const names = [
    ...new Set(
      Object.values(catalog?.boxes || {})
        .filter((b) => !b.error)
        .map((b) => b.name),
    ),
  ]
  return names.length ? ` from ${names.join(' and ')}` : ''
}

// Stash ran nothing: the job failed before the task started, which means
// Stash found no Python to run it with.
function failureText(error) {
  if (/python|executable file not found|no such file/i.test(error))
    return 'Stash found no Python to run the check with. Install Python 3, or set its path in Settings › System › Python path.'
  return `Stash could not run the check: ${error}`
}

function Status({ catalog, check }) {
  const run = catalog?.run
  let line
  if (check.running) {
    const of = run?.state === 'running' ? run.of : 0
    line = (
      <>
        <Loading inline small message="" />
        <span>
          {of
            ? `Checking ${Math.min(run.checked + 1, of)} of ${of}…`
            : 'Checking your favourite studios…'}
        </span>
      </>
    )
  } else if (check.error) {
    line = (
      <span className="newreleases-failed">{failureText(check.error)}</span>
    )
  } else if (run?.state === 'failed') {
    line = (
      <span className="newreleases-failed">
        The last check failed: {run.message}
      </span>
    )
  } else if (run?.finished) {
    line = (
      <span>
        Checked {ago(run.finished)}
        {sourcesText(catalog)}.
      </span>
    )
  } else {
    line = <span>Not checked yet.</span>
  }
  return <div className="newreleases-status text-muted">{line}</div>
}

function Notes({ setup, catalog }) {
  const { unlinked } = linkedStudios(setup.favourites, setup.boxes)
  const notes = []
  if (!setup.boxes.length)
    notes.push(
      <li key="boxes">
        {PLUGIN_NAME} asks your stash-boxes for releases, and Stash has none set
        up. Add one in{' '}
        <Link to="/settings?tab=metadata-providers">
          Settings › Metadata Providers
        </Link>
        .
      </li>,
    )
  else if (!setup.favourites.length)
    notes.push(
      <li key="favourites">
        Favourite a studio on the <Link to="/studios">Studios</Link> page and
        its newest releases show here.
      </li>,
    )
  if (setup.boxes.length && unlinked.length)
    notes.push(
      <li key="unlinked">
        {unlinked.length === 1
          ? '1 favourite studio has'
          : `${unlinked.length} favourite studios have`}{' '}
        no link to a stash-box, so {PLUGIN_NAME} can't ask about{' '}
        {unlinked.length === 1 ? 'it' : 'them'}:{' '}
        {unlinked.map((s, i) => (
          <React.Fragment key={s.id}>
            {i ? ', ' : null}
            <Link to={`/studios/${s.id}`}>{s.name}</Link>
          </React.Fragment>
        ))}
        . Link them in the <Link to="/studios?disp=3">studio Tagger</Link>.
      </li>,
    )
  for (const p of problems(catalog, setup.favourites))
    notes.push(<li key={p.key}>{p.text}</li>)
  return notes.length ? (
    <ul className="newreleases-notes text-muted">{notes}</ul>
  ) : null
}

// ------------------------------------------------------------ the grid

// Stash's scene grid: preferred card widths per zoom level, and how it fits
// cards to the row (GridCard's calculateCardWidth). Phones take the width
// Stash's own CSS gives them.
const ZOOM_WIDTHS = [280, 340, 480, 640]
const isPhone = () =>
  window.matchMedia('only screen and (max-width: 576px)').matches
function cardWidth(container, zoom) {
  if (isPhone()) return undefined
  const preferred = ZOOM_WIDTHS[zoom] ?? ZOOM_WIDTHS[1]
  if (!container) return preferred
  const usable = container - 30
  return usable / Math.ceil(usable / preferred) - 10
}

function useWidth() {
  const [el, setEl] = React.useState(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      setWidth((old) => (Math.abs(old - w) > 20 ? w : old))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, width]
}

function useUrlFilters() {
  const location = useLocation()
  const history = useHistory()
  const filters = React.useMemo(
    () => parseFilters(location.search),
    [location.search],
  )
  const set = React.useCallback(
    (next) =>
      history.replace({
        pathname: location.pathname,
        search: formatFilters(next, location.search),
      }),
    [history, location.pathname, location.search],
  )
  return [filters, set]
}

// The scenes that hold releases by StashID: read with the library at
// first, then again in the background as the task adds releases.
function useHeld(visit, catalog) {
  const first = read(`${visit}held`, () => heldScenes(catalog))
  const [held, setHeld] = React.useState(first)
  const saved = React.useRef(catalog?.saved)
  React.useEffect(() => {
    if (catalog?.saved === saved.current) return
    saved.current = catalog?.saved
    let live = true
    heldScenes(catalog)
      .then((list) => live && setHeld(list))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [catalog])
  return held
}

const PaginationIndex = ({ shown, total }) => (
  <span className="filter-container text-muted paginationIndex center-text">
    {`${total ? 1 : 0}-${shown.toLocaleString()} of ${total.toLocaleString()}`}
  </span>
)

function Releases({ visit, setup, catalog, running }) {
  const library = read(`${visit}library`, () => loadLibrary(setup.favourites))
  const held = useHeld(visit, catalog)
  const indexes = React.useMemo(
    () => ({
      tags: tagIndex(library.tags),
      performers: performerIndex(library.performers),
    }),
    [library],
  )
  const owned = React.useMemo(
    () => ownedIndex([...library.scenes, ...held]),
    [library, held],
  )
  const releases = React.useMemo(
    () =>
      presentReleases(catalog, {
        studios: setup.favourites,
        ...indexes,
        owned,
      }),
    [catalog, setup.favourites, indexes, owned],
  )
  const [filters, setFilters] = useUrlFilters()
  const shown = React.useMemo(
    () => applyFilters(releases, filters),
    [releases, filters],
  )
  const performerOptions = React.useMemo(
    () => optionsOf(releases, 'performers'),
    [releases],
  )
  const tagOptions = React.useMemo(
    () => optionsOf(releases, 'tags'),
    [releases],
  )
  const [limit, setLimit] = React.useState(STEP)
  const filterKey = formatFilters(filters)
  React.useEffect(() => setLimit(STEP), [filterKey])
  const [gridRef, gridWidth] = useWidth()
  const width = cardWidth(gridWidth, 1)

  // A performer or tag on a card adds itself to the filters.
  const pick = (kind, key) => {
    if (filters[kind].some((p) => p.key === key && !p.exclude)) return
    setFilters({
      ...filters,
      [kind]: [
        ...filters[kind].filter((p) => p.key !== key),
        { key, exclude: false },
      ],
    })
  }

  if (!releases.length && running)
    return <Loading message="Asking your stash-boxes…" />
  return (
    <>
      <Toolbar
        favourites={setup.favourites}
        performerOptions={performerOptions}
        tagOptions={tagOptions}
        filters={filters}
        onChange={setFilters}
      />
      <PaginationIndex
        shown={Math.min(limit, shown.length)}
        total={shown.length}
      />
      <div
        className="row justify-content-center newreleases-grid"
        ref={gridRef}
      >
        {shown.slice(0, limit).map((r) => (
          <ReleaseCard
            key={r.key}
            release={r}
            width={width}
            zoom={1}
            onPick={pick}
          />
        ))}
      </div>
      {shown.length > limit ? (
        <div className="newreleases-more">
          <Button variant="secondary" onClick={() => setLimit((n) => n + STEP)}>
            Show more
          </Button>
        </div>
      ) : null}
    </>
  )
}

// ------------------------------------------------------------ the page

function Store({ visit }) {
  const setup = read(`${visit}setup`, loadSetup)
  const first = read(`${visit}catalog`, async () => {
    const [catalog, job] = await Promise.all([loadCatalog(), queuedCheck()])
    return { catalog, job }
  })
  const { catalog, check } = useChecks(visit, setup, first)
  const ready = setup.boxes.length && setup.favourites.length
  return (
    <>
      <Status catalog={catalog} check={check} />
      <Notes setup={setup} catalog={catalog} />
      {ready ? (
        <React.Suspense fallback={<Loading />}>
          <Releases
            visit={visit}
            setup={setup}
            catalog={catalog}
            running={check.running}
          />
        </React.Suspense>
      ) : null}
    </>
  )
}

const Failed = ({ error }) => (
  <div className="newreleases-status newreleases-failed">
    {PLUGIN_NAME} could not load: {error?.message || String(error)}
  </div>
)

let visits = 0

export function NewReleasesPage() {
  const [visit] = React.useState(() => `visit${++visits}:`)
  React.useEffect(() => () => forget(visit), [visit])
  return (
    <div className="newreleases-page">
      <Safe
        name="the New Releases page"
        fallback={(error) => <Failed error={error} />}
      >
        <React.Suspense fallback={<Loading />}>
          <Store visit={visit} />
        </React.Suspense>
      </Safe>
    </div>
  )
}
