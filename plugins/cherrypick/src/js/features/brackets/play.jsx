// The play dialog: two big cards, pick one. ←/→ or a tap picks, U or
// Backspace undoes, Esc or × pauses. Every pick needs an answer: there is no
// "Can't decide". No video plays in a bracket. A card shows no rating, seed
// or rating-based reason, so a pick is not pulled toward past ratings, and
// an anchor looks like any other entrant.
import { FontAwesomeSolid, React } from '../../runtime/api.js'
import { store } from '../../runtime/app.js'
import * as BR from '../../model/brackets.js'
import { useAppState } from '../../ui/hooks.js'
import {
  abandonBracket,
  pauseBracket,
  pickWinner,
  undoPick,
  VIEWS,
} from './actions.js'
import {
  BracketIcon,
  BracketTree,
  ByesNote,
  Dialog,
  Icon,
  plural,
} from './parts.jsx'

const { faRotateLeft, faUndo } = FontAwesomeSolid

// One side of a match, as a big card. Also the Challenge round's.
export function Contender({ b, id, side, onPick }) {
  const M = useAppState((s) => s.M)
  if (!M) return null
  const key = (
    <span className="cherrypick-key badge badge-dark">
      {side === 'left' ? '←' : '→'}
    </span>
  )
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPick()
    }
  }
  if (b.kind === 'performer') {
    const p = M.db.performers.get(id)
    const n = p?.local?.scene_count ?? p?.ownedSceneIds.length ?? 0
    return (
      <div
        role="button"
        tabIndex={0}
        className={`card cherrypick-contender performer side-${side}`}
        onClick={onPick}
        onKeyDown={onKeyDown}
      >
        <div className="cherrypick-cont-img">
          {p?.image ? <img src={p.image} alt="" /> : null}
          {key}
        </div>
        <div className="cherrypick-cont-body">
          <div className="cherrypick-cont-title">
            {p?.name || 'A removed performer'}
          </div>
          <div className="small text-muted">
            {n} {plural(n, 'scene')}
          </div>
        </div>
      </div>
    )
  }
  const s = M.db.scenes.get(id)
  return (
    <div
      role="button"
      tabIndex={0}
      className={`card cherrypick-contender clip side-${side}`}
      onClick={onPick}
      onKeyDown={onKeyDown}
    >
      <div className="cherrypick-cont-img">
        {s?.image ? <img src={s.image} alt="" /> : null}
        {key}
      </div>
      <div className="cherrypick-cont-body">
        <div className="cherrypick-cont-title">
          {s?.title || 'A removed scene'}
        </div>
        <div className="small text-muted">
          {[s?.studio?.name, s?.date].filter(Boolean).join(' · ')}
        </div>
        <div className="small cherrypick-cont-reason">
          {(s?.performers || [])
            .slice(0, 3)
            .map((p) => p.name)
            .join(', ')}
        </div>
      </div>
    </div>
  )
}

// Keys while a dialog of `view` is up. They go no further, so Stash's own
// shortcuts (page keys, "e" to edit) don't act on the page behind. Esc is
// left to the Modal, which pauses; Tab, Enter and Space to the focused
// control. onKey(key) acts on the store as it is now and returns whether
// it took the key.
const PASS = new Set(['Escape', 'Tab', 'Enter', ' '])

export function usePickKeys(view, onKey) {
  const latest = React.useRef(onKey)
  latest.current = onKey
  React.useEffect(() => {
    const listener = (e) => {
      if (store.get().dialog?.view !== view) return
      if (PASS.has(e.key)) return
      e.stopPropagation()
      if (e.type !== 'keydown' || e.altKey || e.ctrlKey || e.metaKey) return
      if (latest.current(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', listener, true)
    window.addEventListener('keypress', listener, true)
    return () => {
      window.removeEventListener('keydown', listener, true)
      window.removeEventListener('keypress', listener, true)
    }
  }, [view])
}

export const isUndoKey = (k) => k === 'Backspace' || k === 'u' || k === 'U'

function useBracketKeys(setTree) {
  usePickKeys(VIEWS.play, (k) => {
    const a = store.get().brackets.active
    const cur = a ? BR.bracketState(a).current : null
    if (!cur) return false
    if (k === 'ArrowLeft') pickWinner(cur.a)
    else if (k === 'ArrowRight') pickWinner(cur.b)
    else if (isUndoKey(k)) undoPick()
    else if (k === 't' || k === 'T') setTree((x) => !x)
    else return false
    return true
  })
}

export function PlayDialog() {
  const b = useAppState((s) => s.brackets.active)
  const [tree, setTree] = React.useState(false)
  const [abandoning, setAbandoning] = React.useState(false)
  useBracketKeys(setTree)
  if (!b) return null
  const st = BR.bracketState(b)
  const cur = st.current
  if (!cur) return null
  const kind = b.kind === 'performer' ? 'performers' : 'scenes'
  const footer = abandoning ? (
    <>
      <span className="cherrypick-abandon-ask">
        Abandon this bracket? Its picks are dropped and nothing is recorded.
      </span>
      <span className="cherrypick-footer-spacer" />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setAbandoning(false)}
      >
        Keep playing
      </button>
      <button type="button" className="btn btn-danger" onClick={abandonBracket}>
        Abandon
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!b.decisions.length}
        onClick={undoPick}
      >
        <Icon icon={faRotateLeft || faUndo} />
        <span>Undo</span>
      </button>
      <button
        type="button"
        className={`btn ${tree ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setTree(!tree)}
      >
        <BracketIcon />
        <span>{tree ? 'Back to the match' : 'Show bracket'}</span>
      </button>
      <span className="cherrypick-footer-spacer" />
      <button
        type="button"
        className="btn btn-link btn-sm text-muted"
        onClick={() => setAbandoning(true)}
      >
        Abandon
      </button>
    </>
  )
  return (
    <Dialog
      title={`${b.poolLabel} · ${b.seeds.length} ${kind}`}
      size="xl"
      onHide={pauseBracket}
      className="cherrypick-play-modal"
      headerExtra={
        <span className="cherrypick-round text-muted">{st.label}</span>
      }
      footer={footer}
    >
      <div
        className="progress cherrypick-progress"
        title={`${st.played} of ${st.totalMatches} picks`}
      >
        <div
          className="progress-bar"
          style={{ width: (100 * st.played) / st.totalMatches + '%' }}
        />
      </div>
      {b.kind === 'clip' &&
      b.seeds.length < BR.DEFAULT_SIZE &&
      cur.round === 0 ? (
        <ByesNote n={b.seeds.length} className="cherrypick-play-byes" />
      ) : null}
      {tree ? (
        <BracketTree b={b} st={st} />
      ) : (
        <>
          <div className={`cherrypick-match ${b.kind}`}>
            <Contender
              key={'a' + cur.a}
              b={b}
              id={cur.a}
              side="left"
              onPick={() => pickWinner(cur.a)}
            />
            <Contender
              key={'b' + cur.b}
              b={b}
              id={cur.b}
              side="right"
              onPick={() => pickWinner(cur.b)}
            />
          </div>
          <p className="cherrypick-hints small text-muted">
            <span className="cherrypick-hints-keys">
              <kbd>←</kbd> <kbd>→</kbd> pick · <kbd>U</kbd> undo ·{' '}
              <kbd>Esc</kbd> pause
            </span>
            <span className="cherrypick-hints-touch">
              Tap a side to pick it. Close to pause.
            </span>
          </p>
        </>
      )}
    </Dialog>
  )
}
