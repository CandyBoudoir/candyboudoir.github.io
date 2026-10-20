// The Challenge round: a bracket's champion against up to three performers
// or scenes the user has rated, lowest rated first, until one beats it.
// The cards are the bracket's, with no rating or seed on them; a scene
// round has the scene bracket's Look closer and inspector. ←/→ or a tap
// picks, U or Backspace undoes, Esc or × goes back to the champion screen
// with the picks kept. On the bracket map the round has its own map, the
// champion's road past each favorite to the trophy (map/gauntlet.jsx);
// Brackets Classic Mode keeps the plain match.
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
import { LookFooter, LookHints, MatchHints, SceneInspector } from './judge.jsx'
import { Dialog, Icon, useEntrant } from './parts.jsx'
import { Contender, isUndoKey, usePickKeys, useSceneMatch } from './play.jsx'
import { toggleSound, useGamepad } from './map/fx.js'
import { ChallengeBanner, Gauntlet, gauntletEffect } from './map/gauntlet.jsx'
import { MapPair } from './map/sides.jsx'
import { gated, MatchStage, SoundButton } from './map/stage.jsx'

const { faRotateLeft, faUndo } = FontAwesomeSolid

// The champion on the left in the first match, then on alternate sides
const sidesOf = (champ, st) =>
  st.beaten.length % 2 ? [st.current, champ] : [champ, st.current]

const bracketOf = (id) => store.get().brackets.history.find((x) => x.id === id)

export function ChallengeDialog({ id }) {
  const b = useAppState((s) => s.brackets.history.find((x) => x.id === id))
  const entrant = useEntrant(b?.kind || 'performer')
  const st = BR.challengeState(b)
  const pair = st?.current ? sidesOf(b.result.champion, st) : null
  // the next rung, if the champion beats this one
  const next = st?.current
    ? st.rungs.slice(st.beaten.length + 1, st.beaten.length + 2)
    : []
  const match = useSceneMatch(b?.kind, pair, next, (winner) =>
    pickChallenge(id, winner, BR.challengeState(bracketOf(id)).current),
  )
  const classic = useAppState((s) => !!s.settings.classicBrackets)
  const pickNow = (x) => (classic ? match.pick(x) : gated(() => match.pick(x)))
  // the sides on screen now, read from the store as keys and buttons come
  const sidesNow = () => {
    const now = bracketOf(id)
    const cur = BR.challengeState(now)
    return cur?.current ? sidesOf(now.result.champion, cur) : null
  }
  const undo = () => {
    if (BR.challengeState(bracketOf(id))?.started) undoChallengePick(id)
  }
  useGamepad(!classic && !match.look, {
    left: () => sidesNow() && pickNow(sidesNow()[0]),
    right: () => sidesNow() && pickNow(sidesNow()[1]),
    undo,
  })
  usePickKeys(
    VIEWS.challenge,
    (k, e) => {
      const taken = match.onKey(k, e)
      if (taken != null) return taken
      const sides = sidesNow()
      if (!sides) return false
      if (k === 'ArrowLeft') pickNow(sides[0])
      else if (k === 'ArrowRight') pickNow(sides[1])
      else if (isUndoKey(k)) undo()
      else if (!classic && (k === 'm' || k === 'M')) toggleSound()
      else return false
      return true
    },
    match.claims,
  )
  if (!st?.current) return null
  const n = st.rungs.length
  const i = st.beaten.length
  const [left, right] = pair
  const look = match.look
  const hints =
    b.kind === 'clip' ? (
      <MatchHints esc="back" sound={!classic} />
    ) : (
      <p className="cherrypick-hints small text-muted">
        <span className="cherrypick-hints-keys">
          <kbd>←</kbd> <kbd>→</kbd> pick · <kbd>U</kbd> undo · <kbd>Esc</kbd>{' '}
          back
          {classic ? null : (
            <>
              {' '}
              · <kbd>M</kbd> sound
            </>
          )}
        </span>
        <span className="cherrypick-hints-touch">
          Tap a side to pick it. Close to go back.
        </span>
      </p>
    )
  return (
    <Dialog
      title={`Challenge round · ${entrant(b.result.champion).name}`}
      size="xl"
      onHide={() => leaveChallenge(id)}
      className={`cherrypick-play-modal cherrypick-challenge-modal${look ? ' cherrypick-looking' : ''}`}
      headerExtra={
        <>
          <span className="cherrypick-round text-muted">
            {n > 1 ? `Favorite ${i + 1} of ${n}` : 'Your favorite'}
          </span>
          {classic ? null : <SoundButton />}
        </>
      }
      footer={
        look ? (
          <LookFooter
            look={look}
            setLook={match.setLook}
            pair={pair}
            pick={match.pick}
            titleOf={(x) => entrant(x).name}
          />
        ) : (
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
        )
      }
    >
      <div
        className="progress cherrypick-progress"
        title={`${i} of ${n} beaten`}
      >
        <div className="progress-bar" style={{ width: (100 * i) / n + '%' }} />
      </div>
      {look ? (
        <>
          <SceneInspector
            key={look.id}
            id={look.id}
            frame={look.frame}
            setFrame={(frame) => match.setLook({ ...look, frame })}
          />
          <LookHints id={look.id} />
        </>
      ) : classic ? (
        <>
          <div className={`cherrypick-match ${b.kind}`}>
            <Contender
              key={'l' + left}
              b={b}
              id={left}
              side="left"
              onPick={() => match.pick(left)}
              onLook={(frame) => match.setLook({ id: left, frame })}
            />
            <Contender
              key={'r' + right}
              b={b}
              id={right}
              side="right"
              onPick={() => match.pick(right)}
              onLook={(frame) => match.setLook({ id: right, frame })}
            />
          </div>
          {hints}
        </>
      ) : (
        <>
          <MatchStage
            run={b.id + ':challenge'}
            n={b.challenge.decisions.length}
            pair={pair}
            round={0}
            opening={!st.started}
            winnerOf={(k) => b.challenge.decisions[k - 1]?.winner}
            className={`cherrypick-map-stage cherrypick-challenge-stage ${b.kind}`}
            pick={match.pick}
            onLook={(x, frame) => match.setLook({ id: x, frame })}
            renderPair={(layer, on) => (
              <MapPair
                kind={b.kind}
                layer={layer}
                crown={b.result.champion}
                {...on}
              />
            )}
            renderTop={() =>
              b.kind === 'clip' ? <Gauntlet b={b} cs={st} /> : null
            }
            renderBottom={() =>
              b.kind === 'clip' ? null : <Gauntlet b={b} cs={st} />
            }
            renderBanner={() => <ChallengeBanner n={n} />}
            effect={gauntletEffect}
          />
          {hints}
        </>
      )}
    </Dialog>
  )
}
