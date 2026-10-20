// The New Releases page, at /plugins/newreleases. It shows the catalog the
// task keeps at once, starts the task when the catalog is a day old (or a
// studio was favourited since), and fills in as the task saves each studio.
// The list keeps what the page opened with, so nothing in it moves; what a
// running check adds goes to a Just in row above it until the next visit. A
// page that opened with nothing fills its list as releases arrive. Releases
// the user has never show, and those their studio's latest check found are
// New. It sorts and pages as Stash's lists do, with Stash's own sort menu
// and pagination. Loading waits behind Suspense boundaries with Stash's own
// loader: the stash-boxes, favourites and catalog first, then the user's
// tags, performers and scenes that name the releases and hide the ones they
// have.
import {
  components,
  loadableComponents,
  React,
  ReactRouterDOM,
  Slider,
  utils,
} from '../api.js'
import { ago, linkedStudios, problems, shouldStart } from '../data/catalog.js'
import {
  applyFilters,
  formatFilters,
  optionsOf,
  pageOf,
  parseFilters,
} from '../data/filters.js'
import {
  ownedIndex,
  performerIndex,
  presentReleases,
  tagIndex,
  uncovered,
} from '../data/match.js'
import {
  isNew,
  newSeed,
  newSince,
  sortReleases,
  splitArrivals,
} from '../data/sort.js'
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

const { Link, useHistory, useLocation } = ReactRouterDOM

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
          // The read beside the job's may predate the task's last save
          const last = await loadCatalog().catch(() => null)
          if (!live) return
          if (last) setCatalog(last)
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
  // Random with no seed takes one into the address, as Stash's lists do,
  // so the order holds across a reload
  React.useEffect(() => {
    if (filters.sortBy === 'random' && filters.seed == null)
      set({ ...filters, seed: newSeed() })
  }, [filters, set])
  return [filters, set]
}

// The scenes that hold releases by StashID, and which releases that
// covers: read with the library at first, then again in the background
// whenever the catalog holds a release the last lookup did not cover. A
// release waits until it is covered, so one the user has never shows, even
// for a moment. Keyed on the releases left to cover and the save, not the
// catalog read: two reads of one save (the last tick of a check reads
// twice) must not cancel the lookup. The save's stamp alone is not enough:
// it counts whole seconds, so a check that saves within the second of the
// catalog the page opened with would add releases that never show.
function useHeld(visit, catalog) {
  const first = read(`${visit}held`, () => heldScenes(catalog))
  const [held, setHeld] = React.useState(first)
  const latest = React.useRef(catalog)
  React.useEffect(() => {
    latest.current = catalog
  })
  const missing = uncovered(catalog, held.keys)
  const saved = catalog?.saved
  React.useEffect(() => {
    if (!missing) return
    let live = true
    heldScenes(latest.current)
      .then((next) => live && setHeld(next))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [missing, saved])
  return held
}

// Stash's own Pagination and PaginationIndex (List/Pagination.tsx), which
// Stash registers once its list code has loaded; Releases loads it first.
// Where a Stash version has not registered them, the same markup.
function Pager({ total, page, perPage, onPage, placement }) {
  const { Pagination } = components
  if (Pagination)
    return (
      <Pagination
        itemsPerPage={perPage}
        currentPage={page}
        totalItems={total}
        onChangePage={onPage}
        pagePopupPlacement={placement}
      />
    )
  const pages = Math.ceil(total / perPage)
  if (pages <= 1) return <div />
  const button = (label, to, disabled, title) => (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={disabled}
      title={title}
      onClick={() => onPage(to)}
    >
      {label}
    </button>
  )
  return (
    <div className="pagination btn-group">
      {button('«', 1, page === 1, 'First')}
      {button('<', page - 1, page === 1, 'Previous')}
      <button type="button" className="btn btn-secondary page-count" disabled>
        {`${page} of ${pages}`}
      </button>
      {button('>', page + 1, page === pages, 'Next')}
      {button('»', pages, page === pages, 'Last')}
    </div>
  )
}

function Index({ total, page, perPage }) {
  const { PaginationIndex } = components
  if (PaginationIndex)
    return (
      <PaginationIndex
        itemsPerPage={perPage}
        currentPage={page}
        totalItems={total}
      />
    )
  const first = Math.min((page - 1) * perPage + 1, total)
  const last = Math.min(first + perPage - 1, total)
  return (
    <span className="filter-container text-muted paginationIndex center-text">
      {`${first.toLocaleString()}-${last.toLocaleString()} of ${total.toLocaleString()}`}
    </span>
  )
}

// Stash's scene list code, which registers Pagination, PaginationIndex and
// TruncatedText, and its front page's, which registers RecommendationRow: a
// visit straight to this page has loaded neither.
const loadStashLists = () =>
  utils
    .loadComponents([
      loadableComponents.SceneList,
      loadableComponents.FrontPage,
    ])
    .catch(() => {})

// Stash's own slider settings for its front-page rows
// (src/core/recommendations.ts), which plugins cannot import.
function sliderSettings(cards, isTouch) {
  const at = (show) => ({
    infinite: !isTouch && cards > show,
    slidesToShow: cards > show ? show : cards,
    slidesToScroll: isTouch ? 1 : cards > show ? show : cards,
  })
  return {
    dots: !isTouch,
    arrows: !isTouch,
    speed: 300,
    variableWidth: true,
    swipeToSlide: true,
    ...at(5),
    responsive: [
      { breakpoint: 1909, settings: at(4) },
      { breakpoint: 1542, settings: at(3) },
      { breakpoint: 1170, settings: at(2) },
      { breakpoint: 801, settings: at(1) },
    ],
  }
}
const isTouch = () => window.matchMedia('(pointer: coarse)').matches

// Stash's RecommendationRow, or its markup where Stash has not registered
// it yet.
function Row({ className, header, link, children }) {
  const { RecommendationRow } = components
  if (RecommendationRow)
    return (
      <RecommendationRow className={className} header={header} link={link}>
        {children}
      </RecommendationRow>
    )
  return (
    <div className={`recommendation-row ${className}`}>
      <div className="recommendation-row-head">
        <div>
          <h2>{header}</h2>
        </div>
        {link}
      </div>
      {children}
    </div>
  )
}

// What a running check found while the page was open, newest first, in a
// row like Stash's front page's, in its container, so the list below never
// moves.
function JustIn({ releases, since, onPick }) {
  if (!releases.length) return null
  return (
    <div className="recommendations-container newreleases-just-in-container">
      <Row
        className="newreleases-just-in"
        header="Just in"
        link={
          <span className="text-muted newreleases-just-in-note">
            In the list on your next visit
          </span>
        }
      >
        <Slider {...sliderSettings(releases.length, isTouch())}>
          {releases.map((r) => (
            <ReleaseCard
              key={r.key}
              release={r}
              zoom={1}
              isNew={isNew(r, since)}
              onPick={onPick}
            />
          ))}
        </Slider>
      </Row>
    </div>
  )
}

function Releases({ visit, setup, catalog, since, running }) {
  read(`${visit}lists`, loadStashLists)
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
    () => ownedIndex([...library.scenes, ...held.scenes]),
    [library, held],
  )
  const releases = React.useMemo(
    () =>
      presentReleases(catalog, {
        studios: setup.favourites,
        ...indexes,
        owned,
      }).filter((r) => held.keys.has(r.key)),
    [catalog, setup.favourites, indexes, owned, held],
  )
  // The list keeps what the page opened with; later arrivals go to Just in
  const opened = React.useRef(undefined)
  if (opened.current === undefined)
    opened.current = releases.length
      ? new Set(releases.map((r) => r.key))
      : null
  const arrived = React.useRef(new Map())
  const { list, justIn } = React.useMemo(() => {
    const split = splitArrivals(releases, opened.current, arrived.current)
    arrived.current = split.arrived
    return split
  }, [releases])
  const [filters, setFilters] = useUrlFilters()
  const shown = React.useMemo(
    () => sortReleases(applyFilters(list, filters), filters),
    [list, filters],
  )
  const justInShown = React.useMemo(
    () => applyFilters(justIn, filters),
    [justIn, filters],
  )
  const performerOptions = React.useMemo(
    () => optionsOf(releases, 'performers'),
    [releases],
  )
  const tagOptions = React.useMemo(
    () => optionsOf(releases, 'tags'),
    [releases],
  )
  const { items, page } = pageOf(shown, filters)
  const [gridRef, gridWidth] = useWidth()
  const width = cardWidth(gridWidth, 1)

  // A performer or tag on a card adds itself to the filters.
  const pick = (kind, key) => {
    if (filters[kind].some((p) => p.key === key && !p.exclude)) return
    setFilters({
      ...filters,
      page: 1,
      [kind]: [
        ...filters[kind].filter((p) => p.key !== key),
        { key, exclude: false },
      ],
    })
  }
  // As on Stash's lists, a new page starts at the top
  const toPage = (to) => {
    setFilters({ ...filters, page: to })
    window.scrollTo(0, 0)
  }
  const paging = { total: shown.length, page, perPage: filters.perPage }

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
      <JustIn releases={justInShown} since={since} onPick={pick} />
      <div className="pagination-index-container">
        <Pager {...paging} onPage={toPage} />
        <Index {...paging} />
      </div>
      <div
        className="row justify-content-center newreleases-grid"
        ref={gridRef}
      >
        {items.map((r) => (
          <ReleaseCard
            key={r.key}
            release={r}
            width={width}
            zoom={1}
            isNew={isNew(r, since)}
            onPick={pick}
          />
        ))}
      </div>
      {shown.length > filters.perPage ? (
        <div className="pagination-footer-container">
          <div className="pagination-footer">
            <Pager {...paging} onPage={toPage} placement="top" />
          </div>
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
  // New: what each studio's latest check found when the page opened, and
  // anything found since
  const since = React.useMemo(() => newSince(first.catalog), [first])
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
            since={since}
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
