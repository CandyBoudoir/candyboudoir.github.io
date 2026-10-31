// The plugin's one page, at /plugins/cherrypick, reached from the navbar's
// cherries, the rows' View all and Settings › Plugins. Three tabs, as on
// Stash's performer page, each at its own address: For you
// (forYouPage.jsx), the Hall of Fame and Manage. With the For you switch off
// the tab goes and the page opens on the Hall of Fame. A line on top says
// where Your score stands and starts a bracket; a footer has the version,
// the links and Ko-fi. Hall of Fame and Manage are Stash settings sections
// and cards: features add their own (registerPageSection); this file holds
// Your score (with the offer beside Stash Curator), Not interested, Don't
// learn and Remove.
import {
  Bootstrap,
  FontAwesomeSolid,
  components,
  React,
  ReactRouterDOM,
  register,
} from '../runtime/api.js'
import {
  answerCuratorOffer,
  toggleDontLearn,
  undoNotInterested,
} from '../runtime/actions.js'
import { allDecisions } from '../runtime/engine.js'
import { rateMore } from '../model/index.js'
import { sourcesText } from '../model/matches.js'
import { andList, tagNames } from '../model/util.js'
import { MIN_RATED } from '../model/taste.js'
import { toRateUrl } from '../data/listFilter.js'
import {
  FOR_YOU_TAB,
  HALL_OF_FAME_TAB,
  MANAGE_TAB,
  NAME_S,
  PLUGIN_ID,
  PLUGIN_NAME,
  PLUGIN_ROUTE,
} from '../name.js'
import { Cherries } from '../ui/Cherries.jsx'
import { closeDialog, openDialog, registerDialog } from '../ui/dialogs.jsx'
import { useAppState } from '../ui/hooks.js'
import { Safe } from '../ui/Safe.jsx'
import { removePluginData, removalCounts } from './remove.js'
import { OFFER, useCuratorOffer } from './curatorOffer.js'
import { ForYouTab } from './forYouPage.jsx'
import { useBracketsOn } from './brackets/parts.jsx'
import {
  quickStartClip,
  quickStartPerformers,
  resumeBracket,
} from './brackets/actions.js'
import { scenePool } from '../model/bracketSetup.js'
import { run } from '../runtime/app.js'

const { Button, Modal, Tab, Tabs } = Bootstrap
const { faMugHot } = FontAwesomeSolid
const { Link, useHistory, useLocation } = ReactRouterDOM

const REPO = 'https://github.com/CandyBoudoir/candyboudoir.github.io'
const LINKS = {
  changes: `${REPO}/blob/main/plugins/cherrypick/CHANGELOG.md`,
  forum: 'https://discourse.stashapp.cc/t/cherry-pick/18889',
  source: `${REPO}/tree/main/plugins/cherrypick`,
  kofi: 'https://ko-fi.com/candyboudoir',
}

const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

// ------------------------------------------------------------ sections

const sections = []

// tab: 'hall-of-fame' or 'manage'. order: where the section sits in its tab
// (Your score 10, Hall of Fame 20, StashDB 30, Not interested 40, Don't
// learn 50, Remove 90). title: null for a section that is its tab.
export function registerPageSection(id, order, title, Component, tab) {
  sections.push({ id, order, title, Component, tab: tab || 'manage' })
  sections.sort((a, b) => a.order - b.order)
}

export function Section({ id, title, children }) {
  return (
    <div className="setting-section cherrypick-section" id={id}>
      {title ? <h1>{title}</h1> : null}
      {children}
    </div>
  )
}

// One row of a settings card: a heading, a line under it, and an action.
export function SettingRow({ title, sub, children }) {
  return (
    <div className="setting">
      <div>
        <h3>{title}</h3>
        {sub ? <div className="sub-heading">{sub}</div> : null}
      </div>
      {/* Stash's .setting lays out two columns; keep the second even when empty. */}
      <div>{children}</div>
    </div>
  )
}

// Beside Stash Curator, the offer to hide Your score on cards
// (curatorOffer.js). After Hide on cards, the card says where to undo it
// for the rest of the visit.
function CuratorOffer() {
  const badges = useAppState((s) => s.settings.badges)
  const answer = useAppState((s) => s.curatorOffer)
  const show = useCuratorOffer(badges)
  const [hid, setHid] = React.useState(false)
  if (hid && answer === 'hide')
    return (
      <div className="card setting-card cherrypick-curator-offer">
        <SettingRow
          title="Your score is off on cards"
          sub="It stays beside the stars on scene pages. Score badges on cards, in Settings › Plugins, brings it back."
        />
      </div>
    )
  if (!show) return null
  return (
    <div className="card setting-card cherrypick-curator-offer">
      <SettingRow title={OFFER.title} sub={OFFER.sub}>
        <Button
          variant="secondary"
          size="sm"
          className="cherrypick-curator-hide"
          onClick={() => {
            setHid(true)
            answerCuratorOffer('hide')
          }}
        >
          {OFFER.hide}
        </Button>{' '}
        <Button
          variant="secondary"
          size="sm"
          className="cherrypick-curator-keep"
          onClick={() => answerCuratorOffer('keep')}
        >
          {OFFER.keep}
        </Button>
      </SettingRow>
    </div>
  )
}

function YourScore() {
  const M = useAppState((s) => s.M)
  const library = useAppState((s) => s.library)
  const brackets = useAppState((s) => s.brackets)
  const cv = M?.cv
  // "412 matches in Ascension and Xenith", when the switch is on and found any
  const matches = M?.matches.count
    ? `${M.matches.count} match${M.matches.count === 1 ? '' : 'es'} in ${sourcesText(M.matches.sources)}`
    : null
  let body
  if (!M)
    body = (
      <SettingRow
        title="Learning your taste…"
        sub={
          library
            ? `${PLUGIN_NAME} is building its model from your Stash ratings and plays.`
            : `${PLUGIN_NAME} is reading your library from Stash.`
        }
      />
    )
  else if (!cv)
    body = (
      <SettingRow
        title={`${rateMore(M)} to start`}
        sub={`Your score needs ${MIN_RATED} rated scenes to check its guesses against. Until then, For you goes by your favorites, performer ratings, brackets and plays.${matches ? ` It also learns from ${matches}.` : ''}`}
      >
        <Link
          className="btn btn-secondary btn-sm cherrypick-rate-link"
          to={toRateUrl()}
        >
          Scenes to rate
        </Link>
      </SettingRow>
    )
  else {
    const decisions = allDecisions({ brackets }).length
    const from = [
      `${M.fits.rated.length} rated scenes`,
      `${M.fits.watchedUnrated.length} watched but unrated`,
      'your performer ratings',
    ]
    if (decisions) from.push(`${decisions} bracket picks`)
    if (matches) from.push(matches)
    body = (
      <>
        <SettingRow
          title={`${M.gate ? 'On' : 'Waiting'}: within half a star ${Math.round(cv.withinModel * 10)} times in 10`}
          sub={`On ${cv.n} ratings it hadn't seen, Your score missed by ${cv.maeModel.toFixed(2)}★ on average; your average alone missed by ${cv.maeBase.toFixed(2)}★ (${Math.round(cv.withinBase * 10)} in 10 within half a star). ${M.gate ? 'It beats your average, so it shows on cards.' : 'It stays hidden until it beats your average.'}`}
        />
        <SettingRow
          title="Learning from"
          sub={`${andList(from)}. Display only: it never writes your Stash ratings.`}
        />
      </>
    )
  }
  return (
    <>
      <CuratorOffer />
      <div className="card setting-card">{body}</div>
    </>
  )
}

function NotInterested() {
  const list = useAppState((s) => s.notInterested)
  return (
    <div className="card setting-card">
      {list.length ? (
        list
          .slice()
          .reverse()
          .map((n) => (
            <SettingRow
              key={n.sceneId}
              title={
                <>
                  {n.title}
                  {n.owned ? null : (
                    <>
                      {' '}
                      <span className="badge badge-secondary">
                        Not in your library
                      </span>
                    </>
                  )}
                </>
              }
              sub={`${n.label ? `Shows less of ${n.label}` : 'Hidden'} · ${shortDate(n.at)}`}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => undoNotInterested(n.sceneId)}
              >
                Undo
              </Button>
            </SettingRow>
          ))
      ) : (
        <SettingRow
          title="Nothing hidden"
          sub={`Not interested, in the menu on a ${PLUGIN_NAME} pick, hides it and shows less of what made it appear.`}
        />
      )}
    </div>
  )
}

// The scenes with a tag from "Tags Cherry Pick doesn't learn from": how many,
// and the names no scene in the library carries (a typo, or a tag renamed
// in Stash since).
function TaggedRow({ names }) {
  const M = useAppState((s) => s.M)
  let sub = 'Counting them…'
  if (M) {
    const found = new Set()
    for (const id of M.dontLearnTagged)
      for (const t of M.db.scenes.get(id).tags) found.add(t.name.toLowerCase())
    const missing = names.filter((n) => !found.has(n.toLowerCase()))
    const n = M.dontLearnTagged.size
    sub = [
      `${n} ${n === 1 ? 'scene' : 'scenes'}`,
      'Change the tags in Settings › Plugins',
      missing.length ? `No scene has the tag ${andList(missing, 'or')}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return (
    <SettingRow title={`Scenes tagged ${andList(names, 'or')}`} sub={sub} />
  )
}

function DontLearnList() {
  const list = useAppState((s) => s.dontLearn)
  const tags = useAppState((s) => s.settings.dontLearnTags)
  const names = tagNames(tags)
  return (
    <div className="card setting-card">
      {names.length ? <TaggedRow names={names} /> : null}
      {list
        .slice()
        .reverse()
        .map((n) => (
          <SettingRow
            key={n.sceneId}
            title={n.title}
            sub={`Its plays, rating and picks stay out of your picks · ${shortDate(n.at)}`}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toggleDontLearn({ id: n.sceneId, title: n.title })}
            >
              Learn from it again
            </Button>
          </SettingRow>
        ))}
      {!names.length && !list.length ? (
        <SettingRow
          title="Learning from everything you watch"
          sub={`To keep scenes out of what ${PLUGIN_NAME} learns, tag them in Stash and add the tags to Tags ${PLUGIN_NAME} doesn't learn from, in Settings › Plugins. A pick's ⋯ menu also has Don't learn from this.`}
        />
      ) : null}
    </div>
  )
}

function Remove() {
  return (
    <div className="card setting-card cherrypick-remove-card">
      <SettingRow
        title="Start over"
        sub={`Removes ${NAME_S} settings and history from Stash's configuration, its custom fields from your performers, and its cache in this browser.`}
      >
        <Button
          variant="danger"
          size="sm"
          onClick={() => openDialog({ view: 'remove' })}
        >
          Remove {PLUGIN_NAME} data…
        </Button>
      </SettingRow>
    </div>
  )
}

function RemoveDialog() {
  const [counts, setCounts] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    removalCounts().then(setCounts, () => setCounts({}))
  }, [])
  const applied = useAppState((s) => s.applied.length)
  return (
    <Modal show onHide={closeDialog} className="cherrypick-ui">
      <Modal.Header closeButton>
        <Modal.Title>Remove {PLUGIN_NAME} data?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {counts ? (
          <ul>
            <li>
              Settings, the Hall of Fame ({counts.brackets ?? 0} brackets), Not
              interested and Don&apos;t learn, from Stash&apos;s configuration
            </li>
            <li>
              Bracket results and provisional marks from{' '}
              {counts.performers ?? 0} performer
              {counts.performers === 1 ? '' : 's'} and {counts.scenes ?? 0}{' '}
              scene{counts.scenes === 1 ? '' : 's'} (custom fields)
            </li>
            <li>
              The library copy, the StashDB cache and row history in this
              browser
            </li>
          </ul>
        ) : (
          <p className="text-muted">Counting…</p>
        )}
        {applied ? (
          <p className="text-warning">
            Ratings {PLUGIN_NAME} applied stay. Undo them on this page first if
            you want them gone.
          </p>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={closeDialog}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy || !counts}
          onClick={async () => {
            setBusy(true)
            await removePluginData()
            closeDialog()
          }}
        >
          {busy ? 'Removing…' : 'Remove'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

// One line on where Your score stands, with the quickest way to sharpen it,
// and the bracket buttons, with Brackets on.
function StatusStrip() {
  const M = useAppState((s) => s.M)
  const active = useAppState((s) => !!s.brackets.active)
  const brackets = useBracketsOn()
  const cv = M?.cv
  let text
  let rate = null
  if (!M) text = 'Learning your taste…'
  else if (!cv) {
    text = `Your score starts once you ${rateMore(M).toLowerCase()}.`
    rate = (
      <Link className="btn btn-secondary btn-sm" to={toRateUrl()}>
        Scenes to rate
      </Link>
    )
  } else
    text = M.gate
      ? `Your score is on: within half a star ${Math.round(cv.withinModel * 10)} times in 10.`
      : 'Your score is waiting until it beats your average.'
  return (
    <div className="cherrypick-strip">
      <span className="cherrypick-strip-text">
        {text}{' '}
        <Link to={`${MANAGE_TAB}#your-score`} className="cherrypick-strip-more">
          Details
        </Link>
      </span>
      <span className="cherrypick-strip-actions">
        {rate}
        {brackets && M ? (
          active ? (
            <Button variant="secondary" size="sm" onClick={resumeBracket}>
              Finish your bracket
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => quickStartPerformers(null)}
              >
                Bracket performers
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  quickStartClip({
                    ids: scenePool(M, null),
                    poolLabel: 'All scenes',
                    poolNote: 'Every scene in your library',
                    short: '',
                    origin: FOR_YOU_TAB,
                  })
                }
              >
                Bracket scenes
              </Button>
            </>
          )
        ) : null}
      </span>
    </div>
  )
}

// The version Stash has installed, the links, and Ko-fi. The link names
// Cherry Pick: Stash's own navbar has a Donate heart, for Stash.
function Footer() {
  const { Icon } = components
  const [version, setVersion] = React.useState(null)
  React.useEffect(() => {
    run('query CherryPickVersion { plugins { id version } }').then(
      (d) => setVersion(d?.plugins?.find((p) => p.id === PLUGIN_ID)?.version),
      () => {},
    )
  }, [])
  return (
    <footer className="cherrypick-footer text-muted">
      <div className="cherrypick-footer-links">
        <span>
          {PLUGIN_NAME}
          {version ? ` ${version}` : ''}
        </span>
        <a href={LINKS.changes} target="_blank" rel="noreferrer">
          What&apos;s new
        </a>
        <a href={LINKS.forum} target="_blank" rel="noreferrer">
          Forum
        </a>
        <a href={LINKS.source} target="_blank" rel="noreferrer">
          Source
        </a>
      </div>
      <div className="cherrypick-footer-kofi">
        <span>
          {PLUGIN_NAME} is free. If it earns its place, you can tip on Ko-fi.
        </span>
        <a
          className="btn btn-secondary btn-sm cherrypick-kofi"
          href={LINKS.kofi}
          target="_blank"
          rel="noreferrer"
        >
          <Icon icon={faMugHot} /> Support {PLUGIN_NAME}
        </a>
      </div>
    </footer>
  )
}

function Sections({ tab }) {
  return sections
    .filter((x) => x.tab === tab)
    .map(({ id, title, Component }) => (
      <Section key={id} id={id} title={title}>
        <Safe name={`${title || id} section`}>
          <Component />
        </Safe>
      </Section>
    ))
}

function ManageTab() {
  return (
    <>
      <p className="text-muted cherrypick-manage-settings">
        {PLUGIN_NAME}&apos;s switches are in Stash&apos;s settings.{' '}
        <Link to="/settings?tab=plugins">Open Settings › Plugins</Link>
      </p>
      <Sections tab="manage" />
    </>
  )
}

const TAB_OF_PATH = {
  [HALL_OF_FAME_TAB]: 'hall-of-fame',
  [MANAGE_TAB]: 'manage',
}
const PATH_OF_TAB = {
  'for-you': FOR_YOU_TAB,
  'hall-of-fame': HALL_OF_FAME_TAB,
  manage: MANAGE_TAB,
}

// The tab an address opens. Links from before the tabs point at a section
// by hash (#hall-of-fame, #stashdb): they open the tab that holds it.
function tabOf(location, forYou) {
  const path = location.pathname.replace(/\/+$/, '')
  const hash = location.hash.slice(1)
  const byHash = hash && sections.find((x) => x.id === hash)?.tab
  const tab = TAB_OF_PATH[path] || byHash || 'for-you'
  return tab === 'for-you' && !forYou ? 'hall-of-fame' : tab
}

function PluginPage() {
  const notice = useAppState((s) => s.notice)
  const forYou = useAppState((s) => s.settings.showForYou)
  const location = useLocation()
  const history = useHistory()
  const tab = tabOf(location, forYou)
  React.useEffect(() => {
    const id = location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [location.hash, tab])
  return (
    <div className="container cherrypick-page cherrypick-ui">
      <h1 className="cherrypick-page-title">
        {PLUGIN_NAME} <Cherries />
      </h1>
      {notice?.kind === 'removed' ? (
        <div className="alert alert-info">
          {PLUGIN_NAME}&apos;s data is gone. It starts over as if just
          installed.
        </div>
      ) : null}
      <StatusStrip />
      <Tabs
        id="cherrypick-tabs"
        className="cherrypick-tabs"
        mountOnEnter
        unmountOnExit
        activeKey={tab}
        onSelect={(key) => key !== tab && history.push(PATH_OF_TAB[key])}
      >
        {forYou ? (
          <Tab eventKey="for-you" title="For you">
            <Safe name="For you tab">
              <ForYouTab />
            </Safe>
          </Tab>
        ) : null}
        <Tab eventKey="hall-of-fame" title="Hall of Fame">
          <Sections tab="hall-of-fame" />
        </Tab>
        <Tab eventKey="manage" title="Manage">
          <ManageTab />
        </Tab>
      </Tabs>
      <Footer />
    </div>
  )
}

export function registerPluginPage() {
  registerPageSection('your-score', 10, 'Your score', YourScore)
  registerPageSection('not-interested', 40, 'Not interested', NotInterested)
  registerPageSection('dont-learn', 50, "Don't learn", DontLearnList)
  registerPageSection('remove', 90, `Remove ${PLUGIN_NAME} data`, Remove)
  registerDialog('remove', RemoveDialog)
  register.route(PLUGIN_ROUTE, () => (
    <Safe name="plugin page">
      <PluginPage />
    </Safe>
  ))
}
