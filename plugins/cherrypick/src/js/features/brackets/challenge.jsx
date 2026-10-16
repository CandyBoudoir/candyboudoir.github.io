// The Challenge round: a bracket's champion against up to three performers
// or scenes the user has rated, lowest rated first, until one beats it.
// The cards are the bracket's, with no rating or seed on them. ←/→ or a tap
// picks, U or Backspace undoes, Esc or × goes back to the champion screen
// with the picks kept.
import { FontAwesomeSolid } from '../../runtime/api.js'
import { store } from '../../runtime/app.js'
import * as BR from '../../model/brackets.js'
import { useAppState } from '../../ui/hooks.js'
import {
  leaveChallenge,
  pickChallenge,
  undoChallengePick,
  VIEWS,
} from './actions.js'
import { Dialog, Icon, useEntrant } from './parts.jsx'
import { Contender, isUndoKey, usePickKeys } from './play.jsx'

const { faRotateLeft, faUndo } = FontAwesomeSolid

// The champion on the left in the first match, then on alternate sides
const sidesOf = (champ, st) =>
  st.beaten.length % 2 ? [st.current, champ] : [champ, st.current]

const bracketOf = (id) => store.get().brackets.history.find((x) => x.id === id)

export function ChallengeDialog({ id }) {
  const b = useAppState((s) => s.brackets.history.find((x) => x.id === id))
  const entrant = useEntrant(b?.kind || 'performer')
  usePickKeys(VIEWS.challenge, (k) => {
    const now = bracketOf(id)
    const st = BR.challengeState(now)
    if (!st?.current) return false
    const [left, right] = sidesOf(now.result.champion, st)
    if (k === 'ArrowLeft') pickChallenge(id, left, st.current)
    else if (k === 'ArrowRight') pickChallenge(id, right, st.current)
    else if (isUndoKey(k)) {
      if (st.started) undoChallengePick(id)
    } else return false
    return true
  })
  const st = BR.challengeState(b)
  if (!st?.current) return null
  const n = st.rungs.length
  const i = st.beaten.length
  const [left, right] = sidesOf(b.result.champion, st)
  return (
    <Dialog
      title={`Challenge round · ${entrant(b.result.champion).name}`}
      size="xl"
      onHide={() => leaveChallenge(id)}
      className="cherrypick-play-modal cherrypick-challenge-modal"
      headerExtra={
        <span className="cherrypick-round text-muted">
          {n > 1 ? `Favorite ${i + 1} of ${n}` : 'Your favorite'}
        </span>
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!st.started}
            onClick={() => undoChallengePick(id)}
          >
            <Icon icon={faRotateLeft || faUndo} />
            <span>Undo</span>
          </button>
          <span className="cherrypick-footer-spacer" />
          <button
            type="button"
            className="btn btn-link btn-sm text-muted"
            onClick={() => leaveChallenge(id)}
          >
            Back to the champion
          </button>
        </>
      }
    >
      <div
        className="progress cherrypick-progress"
        title={`${i} of ${n} beaten`}
      >
        <div className="progress-bar" style={{ width: (100 * i) / n + '%' }} />
      </div>
      <div className={`cherrypick-match ${b.kind}`}>
        <Contender
          key={'l' + left}
          b={b}
          id={left}
          side="left"
          onPick={() => pickChallenge(id, left, st.current)}
        />
        <Contender
          key={'r' + right}
          b={b}
          id={right}
          side="right"
          onPick={() => pickChallenge(id, right, st.current)}
        />
      </div>
      <p className="cherrypick-hints small text-muted">
        <span className="cherrypick-hints-keys">
          <kbd>←</kbd> <kbd>→</kbd> pick · <kbd>U</kbd> undo · <kbd>Esc</kbd>{' '}
          back
        </span>
        <span className="cherrypick-hints-touch">
          Tap a side to pick it. Close to go back.
        </span>
      </p>
    </Dialog>
  )
}
