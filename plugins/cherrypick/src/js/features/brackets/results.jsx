// When a bracket ends: the champion screen (podium, where the results went,
// the champion's rating when no anchor played, Undo of the final pick, a
// Champions round when one is due) and the optional, previewed "Apply to my
// ratings".
import {
  components,
  FontAwesomeSolid,
  React,
  ReactRouterDOM,
} from '../../runtime/api.js'
import { store } from '../../runtime/app.js'
import { allDecisions, computeWithDecisions } from '../../runtime/engine.js'
import * as BR from '../../model/brackets.js'
import { championsRoundPool } from '../../model/bracketSetup.js'
import { fmtStars, genderLabel, pronoun } from '../../model/util.js'
import { customFieldUrl } from '../../data/listFilter.js'
import { NAME_S } from '../../name.js'
import { closeDialog, openDialog } from '../../ui/dialogs.jsx'
import { useAppState } from '../../ui/hooks.js'
import {
  applyRatingChanges,
  dismissApplied,
  installedRankingPlugins,
  setChampionRating,
  startChampionsRound,
  undoApplied,
  undoPick,
  VIEWS,
} from './actions.js'
import {
  BracketIcon,
  BracketTree,
  Dialog,
  Icon,
  plural,
  useEntrant,
} from './parts.jsx'

const { Link } = ReactRouterDOM
const { faCrown, faCheck, faRotateLeft, faUndo } = FontAwesomeSolid

const FIELD_LIST = `${BR.FIELDS.titles}, ${BR.FIELDS.best} and ${BR.FIELDS.last}`
export const WINNERS_URL = customFieldUrl(BR.FIELDS.titles)

const linkTo = (kind, id) =>
  kind === 'performer' ? `/performers/${id}` : `/scenes/${id}`

// How many unrated scenes' Your score this bracket's picks moved (by
// 0.05★ or more)
function useMoved(bracketId) {
  const M = useAppState((s) => s.M)
  return React.useMemo(() => {
    if (!bracketId || !M) return null
    const others = allDecisions(store.get()).filter(
      (d) => d.bracket !== bracketId,
    )
    const before = computeWithDecisions(others)
    if (!before) return null
    return M.db.owned.filter(
      (s) =>
        M.rating(s) == null &&
        Math.abs(M.prediction(s.id).value - before.prediction(s.id).value) >=
          0.05,
    ).length
  }, [bracketId, M])
}

// What an applied batch left alone because another plugin ranks or mirrors
// its rating (at Apply, or since, at Undo): "Left 2 as they are: another
// plugin rates them."
export function keptText(a) {
  const n = a.kept || 0
  if (!n) return null
  return `Left ${n} as ${n === 1 ? 'it is' : 'they are'}: another plugin rates ${n === 1 ? 'it' : 'them'}.`
}

// Undo while there is something to put back; Dismiss once only the note
// about what was left alone remains
export function AppliedButton({ a, className }) {
  const undo = a.changes.length > 0
  return (
    <button
      type="button"
      className={className}
      onClick={() => (undo ? undoApplied(a.id) : dismissApplied(a.id))}
    >
      {undo ? 'Undo' : 'Dismiss'}
    </button>
  )
}

function Applied({ bracketId }) {
  const applied = useAppState((s) => s.applied)
  return applied
    .filter((a) => a.bracketId === bracketId)
    .map((a) => (
      <p className="small cherrypick-applied" key={a.id}>
        <Icon icon={faCheck} className="text-success" />{' '}
        {a.changes.length
          ? `Applied ${a.changes.length} ${plural(a.changes.length, 'rating')}. `
          : ''}
        {keptText(a) ? `${keptText(a)} ` : ''}
        <AppliedButton
          a={a}
          className="btn btn-link btn-sm cherrypick-inline-link"
        />
      </p>
    ))
}

// Stash's own stars for the champion's rating, starting empty: a
// preselected 5★ would make the top of the scale automatic again
function ChampionStars({ b }) {
  const { RatingSystem } = components
  const value = b.championRating ?? null
  const set = (v) => setChampionRating(b.id, v ?? null)
  if (RatingSystem)
    return <RatingSystem value={value} onSetRating={set} clickToRate />
  return (
    <select
      className="form-control form-control-sm cherrypick-champ-select"
      value={value ?? ''}
      onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Stars…</option>
      {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((r) => (
        <option key={r} value={r}>
          {fmtStars(r / 20)}★
        </option>
      ))}
    </select>
  )
}

// When no rated performer or scene played, the user's rating of the
// champion sets the scale: the rest step down from it, half a star a round
export function ChampionPrompt({ b, name, them }) {
  const value = b.championRating ?? null
  return (
    <div className="card cherrypick-fixes cherrypick-champ-rate">
      <p className="mb-2">
        {value == null
          ? `None of this bracket's ${b.kind === 'performer' ? 'performers' : 'scenes'} had a rating of yours to measure against. How many stars for ${name}? The rest are rated below ${them}.`
          : `${name}: ${fmtStars(value / 20)}★. Apply to my ratings sets it, and the rest below it.`}
      </p>
      <ChampionStars b={b} />
    </div>
  )
}

export function ResultDialog({ id }) {
  const M = useAppState((s) => s.M)
  const history = useAppState((s) => s.brackets.history)
  const active = useAppState((s) => s.brackets.active)
  const lastFinished = useAppState((s) => s.lastFinished)
  const b = history.find((x) => x.id === id)
  const [tree, setTree] = React.useState(false)
  const moved = useMoved(b?.id)
  const entrant = useEntrant(b?.kind || 'performer')
  const proposals = React.useMemo(
    () => (b && M ? BR.ratingProposals(M, b) : null),
    [b, M],
  )
  if (!b || !M) return null
  const r = b.result
  const isP = b.kind === 'performer'
  const champ = entrant(r.champion)
  const word = { her: 'she', his: 'he' }[pronoun(champ.p)] || 'they'
  const them = isP
    ? { her: 'her', his: 'him' }[pronoun(champ.p)] || 'them'
    : 'it'
  const ask = proposals?.askChampion || b.championRating != null
  const wins = b.decisions.filter((d) => d.winner === r.champion).length
  const due =
    isP && b.gender && !b.champions && !active
      ? championsRoundPool(M, history, b.gender)
      : null
  const written = b.fieldWrites ? Object.keys(b.fieldWrites).length : null
  const done = (
    <Link to={linkTo(b.kind, r.champion)} onClick={closeDialog}>
      {champ.name}
    </Link>
  )
  return (
    <Dialog
      title={b.champions ? 'Champion of champions' : 'Champion'}
      size="xl"
      onHide={closeDialog}
      className="cherrypick-result-modal"
      headerExtra={
        <span className="text-muted cherrypick-round">
          {b.poolLabel} · {b.seeds.length} {isP ? 'performers' : 'scenes'}
        </span>
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setTree(!tree)}
          >
            <BracketIcon />
            <span>{tree ? 'Hide bracket' : 'Show bracket'}</span>
          </button>
          {lastFinished === b.id ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={undoPick}
            >
              <Icon icon={faRotateLeft || faUndo} />
              <span>Undo the final pick</span>
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary cherrypick-apply-open"
            onClick={() => openDialog({ view: VIEWS.apply, id: b.id })}
          >
            {isP ? 'Apply to my performer ratings…' : 'Apply to my ratings…'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={closeDialog}
          >
            Done
          </button>
        </>
      }
    >
      <div className={`cherrypick-champion ${isP ? 'performer' : 'clip'}`}>
        <Link
          className="cherrypick-champ-img"
          to={linkTo(b.kind, r.champion)}
          onClick={closeDialog}
        >
          {champ.image ? <img src={champ.image} alt="" /> : null}
          <span className="cherrypick-crown text-warning">
            <Icon icon={faCrown} />
          </span>
        </Link>
        <div className="cherrypick-champ-body">
          <h2 className="cherrypick-champ-name">{done}</h2>
          <p className="text-muted">
            {wins} {plural(wins, 'win')} on the way to the top.{' '}
            {isP ? `Long may ${word} reign.` : 'Long may it reign.'}
          </p>
          <p className="small text-muted">
            Every pick fed {NAME_S} model
            {moved == null
              ? '.'
              : `: Your score moved on ${moved} unrated ${plural(moved, 'scene')}`}
            {moved != null && isP
              ? `, and the crown now sits on ${champ.name}'s card.`
              : moved != null
                ? '.'
                : ''}
          </p>
          {isP ? (
            <p className="small text-muted cherrypick-fields-written">
              {written == null
                ? 'Saving the results to their performer records…'
                : written
                  ? `Saved to ${written} performer ${plural(written, 'record')} in Stash as ${FIELD_LIST}.`
                  : null}{' '}
              {written ? (
                <Link to={WINNERS_URL} onClick={closeDialog}>
                  Performers who have won a bracket
                </Link>
              ) : null}
            </p>
          ) : null}
          {ask ? <ChampionPrompt b={b} name={champ.name} them={them} /> : null}
          <Applied bracketId={b.id} />
        </div>
      </div>
      <div className="cherrypick-podium">
        {[
          [r.finalist, 'Finalist'],
          ...r.semifinalists.map((x) => [x, 'Semifinalist']),
        ]
          .filter(([x]) => x)
          .map(([x, label]) => {
            const e = entrant(x)
            return (
              <Link
                key={x}
                className={`card cherrypick-podium-item ${isP ? 'performer' : 'clip'}`}
                to={linkTo(b.kind, x)}
                onClick={closeDialog}
              >
                <span className="cherrypick-podium-img">
                  {e.image ? <img src={e.image} alt="" /> : null}
                </span>
                <span className="small text-muted">{label}</span>
                <span className="cherrypick-podium-name">{e.name}</span>
              </Link>
            )
          })}
      </div>
      {due?.size ? (
        <div className="card cherrypick-fixes cherrypick-champions-due">
          <p className="mb-2">
            {genderLabel(b.gender)} brackets have crowned {due.ids.length}{' '}
            different champions. Time to settle it?
          </p>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => startChampionsRound(b.gender)}
            >
              <Icon icon={faCrown} />
              <span>Champions round ({due.size})</span>
            </button>
          </div>
        </div>
      ) : null}
      {tree ? <BracketTree b={b} st={BR.bracketState(b)} /> : null}
    </Dialog>
  )
}

// ------------------------------------------------------------ Apply (preview)

// Ascension, HotOrNot and Xenith, when installed and enabled (null while
// Stash is asked)
function useRankingPlugins() {
  const [names, setNames] = React.useState(null)
  React.useEffect(() => {
    let live = true
    installedRankingPlugins()
      .then((n) => live && setNames(n))
      .catch(() => live && setNames([]))
    return () => {
      live = false
    }
  }, [])
  return names
}

const andList = (names) =>
  names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : names[0]

// "Ascension is installed. Its rankings start from Stash's ratings, so it
// will pick up every rating you apply here."
function RankingWarning({ names }) {
  if (!names?.length) return null
  const one = names.length === 1
  return (
    <p className="alert alert-warning cherrypick-apply-ranking">
      {andList(names)} {one ? 'is' : 'are'} installed. {one ? 'Its' : 'Their'}{' '}
      rankings start from Stash&apos;s ratings, so {one ? 'it' : 'they'} will
      pick up every rating you apply here.
    </p>
  )
}

export function ApplyDialog({ id }) {
  const M = useAppState((s) => s.M)
  const history = useAppState((s) => s.brackets.history)
  const b = history.find((x) => x.id === id)
  const entrant = useEntrant(b?.kind || 'performer')
  const rankers = useRankingPlugins()
  const [unchecked, setUnchecked] = React.useState(() => new Set())
  const [busy, setBusy] = React.useState(false)
  const { rows, askChampion } = React.useMemo(
    () =>
      b && M ? BR.ratingProposals(M, b) : { rows: [], askChampion: false },
    [b, M],
  )
  if (!b || !M) return null
  const isP = b.kind === 'performer'
  const champ = entrant(b.result.champion)
  const them = isP
    ? { her: 'her', his: 'him' }[pronoun(champ.p)] || 'them'
    : 'it'
  const open = rows.filter((x) => !x.skip)
  const chosen = open.filter((x) => !unchecked.has(x.id))
  // Who ranks the records Apply leaves alone: the one installed, if one is
  const ranker = rankers?.length === 1 ? rankers[0] : 'Another plugin'
  const skipped = (x) =>
    x.skip === 'mirrored'
      ? "Restash's score"
      : `${ranker} ranks ${isP ? 'them' : 'it'}`
  const back = () => openDialog({ view: VIEWS.result, id })
  const toggle = (x) => {
    const n = new Set(unchecked)
    if (n.has(x)) n.delete(x)
    else n.add(x)
    setUnchecked(n)
  }
  const apply = async () => {
    setBusy(true)
    await applyRatingChanges(
      b,
      chosen.map(({ id: x, to, provisional }) => ({ id: x, to, provisional })),
    )
    back()
  }
  return (
    <Dialog
      title={isP ? 'Apply to my performer ratings' : 'Apply to my ratings'}
      onHide={back}
      className="cherrypick-apply-modal"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={back}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary cherrypick-apply-go"
            disabled={!chosen.length || busy}
            onClick={apply}
          >
            {busy
              ? 'Applying…'
              : `Apply ${chosen.length} ${plural(chosen.length, 'rating')}`}
          </button>
        </>
      }
    >
      <p>
        These are the Stash ratings this bracket would set, from where each
        finished against {isP ? 'performers' : 'scenes'} you&apos;ve rated
        {b.sceneAnchors?.length ? " or whose scenes you've rated" : ''}. Your
        own ratings stay as they are. Untick anything you&apos;d rather keep;
        you can undo the whole batch afterwards.
      </p>
      <RankingWarning names={rankers} />
      {askChampion || b.championRating != null ? (
        <ChampionPrompt b={b} name={champ.name} them={them} />
      ) : null}
      {rows.length ? (
        <table className="table table-sm cherrypick-apply-table">
          <thead>
            <tr>
              <th />
              <th>{isP ? 'Performer' : 'Scene'}</th>
              <th className="num">Now</th>
              <th className="num">After</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr
                key={x.id}
                className={x.skip ? 'cherrypick-apply-skipped' : undefined}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={'Apply to ' + entrant(x.id).name}
                    checked={!x.skip && !unchecked.has(x.id)}
                    disabled={!!x.skip}
                    onChange={() => toggle(x.id)}
                  />
                </td>
                <td>{entrant(x.id).name}</td>
                <td className="num">
                  {x.from == null ? (
                    <span className="text-muted">unrated</span>
                  ) : x.primed ? (
                    <span
                      className="text-muted"
                      title="Set by Ascension's Prime task, not by you"
                    >
                      primed
                    </span>
                  ) : x.fromProvisional ? (
                    <span
                      className="text-muted"
                      title="Set by an earlier bracket, under its champion's rating"
                    >
                      {fmtStars(x.from / 20)}★ provisional
                    </span>
                  ) : (
                    fmtStars(x.from / 20) + '★'
                  )}
                </td>
                <td className="num">
                  {x.skip ? (
                    <span className="text-muted">kept</span>
                  ) : (
                    <>
                      <b>{fmtStars(x.to / 20)}★</b>
                      {x.provisional ? (
                        <span
                          className="small text-muted cherrypick-provisional"
                          title="No rating of yours placed it, so a later bracket can correct it"
                        >
                          {' '}
                          provisional
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="small text-muted">
                  {x.skip ? skipped(x) : x.why}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {open.length || askChampion ? null : (
        <p className="text-muted">
          Nothing to set: this bracket has no new ratings to give.
        </p>
      )}
    </Dialog>
  )
}
