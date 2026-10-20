// The stage the bracket map and its Challenge round play on. It changes
// how a match comes and goes, never what a pick does: the same picks,
// Undo, pause, keys and model as Brackets Classic Mode.
//
// Each match on screen is a layer. A pick turns the live layer into a
// leaving one (the same DOM, so it leaves from exactly what was on screen)
// and mounts the next match as the new live layer; both share one grid
// cell. A click or key while the next match is still arriving finishes the
// arrival instead of picking a match nobody has seen yet (gated). Undo
// plays the same backwards. Under prefers-reduced-motion a match swaps at
// once and nothing waits.
import { FontAwesomeSolid, React } from '../../../runtime/api.js'
import { Icon } from '../parts.jsx'
import { calm, finishAll, useSound, useTheme } from './fx.js'

const { faVolumeHigh, faVolumeUp, faVolumeXmark, faVolumeMute } =
  FontAwesomeSolid

// How long the next match takes to arrive after each kind of event (ms),
// and how long the last one takes to leave
const ARRIVE = { pick: 300, undo: 240, resume: 220, start: 1100, round: 1100 }
const LEAVE_MS = 480

// ------------------------------------------------------------ the gate

const gate = { until: 0, root: null, skip: null }

// A pick while the next match is still arriving finishes the arrival
// instead. Returns whether it picked.
export function gated(fn) {
  if (performance.now() < gate.until) {
    finishAll(gate.root)
    gate.skip?.()
    gate.until = 0
    return false
  }
  fn()
  return true
}

// ------------------------------------------------------------ sound

// The speaker in a bracket dialog's header: sound starts off, M toggles it
export function SoundButton() {
  const [on, toggle] = useSound()
  return (
    <button
      type="button"
      className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'} cherrypick-sound`}
      aria-pressed={on}
      aria-label="Sound"
      title={on ? 'Sound on (M)' : 'Sound off (M)'}
      onClick={toggle}
    >
      <Icon
        icon={on ? faVolumeHigh || faVolumeUp : faVolumeXmark || faVolumeMute}
      />
    </button>
  )
}

// ------------------------------------------------------------ layers

// The runs whose opening banner has shown, so a match reopened after a
// pause, Look closer or the whole map comes back without it
const opened = new Set()
let seq = 0

const liveLayer = (pair, round, ev) => ({
  key: ++seq,
  a: pair[0],
  b: pair[1],
  round,
  role: 'live',
  ev,
})

function firstState({ run, n, pair, round, opening }) {
  const fresh = opening && !opened.has(run)
  opened.add(run)
  const ev = { type: fresh ? 'start' : 'resume', round: fresh, n }
  return { run, n, layers: [liveLayer(pair, round, ev)], ev }
}

// The layers after one pick or one Undo; anything else starts afresh
function nextState(s, props) {
  const { run, n, pair, round, winnerOf } = props
  const live = s.layers.find((l) => l.role === 'live')
  if (run !== s.run || Math.abs(n - s.n) !== 1 || !live)
    return firstState({ ...props, opening: false })
  const type = n > s.n ? 'pick' : 'undo'
  const winner = type === 'pick' ? winnerOf(n) : null
  const ev = {
    type,
    round: round !== live.round,
    n,
    winner,
    from: [live.a, live.b],
  }
  const leaving = calm() ? [] : [{ ...live, role: 'exit', exit: type, winner }]
  return { run, n, layers: [...leaving, liveLayer(pair, round, ev)], ev }
}

/**
 * @param {object} props
 * @param {string} props.run  which run of matches: a bracket, or its
 *   Challenge round
 * @param {number} props.n  picks made so far
 * @param {string[]} props.pair  the match on screen
 * @param {number} props.round  a change starts the match with a banner
 * @param {boolean} props.opening  the run starts here: its first mount
 *   opens with the banner
 * @param {(n: number) => string} props.winnerOf  the winner of pick n
 * @param {(layer, handlers) => any} props.renderPair
 * @param {(ev) => any} [props.renderTop]  above the match
 * @param {(ev) => any} [props.renderBottom]  under the match
 * @param {() => any} [props.renderBanner]
 * @param {(ev, ctx) => void} [props.effect]  sounds and flights, once the
 *   new layer is on the page
 * @param {(id: string) => void} props.pick
 * @param {(id: string, frame: number) => void} props.onLook
 */
export function MatchStage(props) {
  const { run, n, pair, className = '', pick, onLook, effect } = props
  const root = React.useRef(null)
  const t = useTheme(root)
  const [s, setS] = React.useState(() => firstState(props))
  const key = `${run}:${n}:${pair[0]}:${pair[1]}`
  const [lastKey, setLastKey] = React.useState(key)
  let shown = s
  if (key !== lastKey) {
    shown = nextState(s, props)
    setS(shown)
    setLastKey(key)
  }

  // the leaving layer goes once it has left
  const exitKey = shown.layers.find((l) => l.role === 'exit')?.key
  React.useEffect(() => {
    if (!exitKey) return
    const id = setTimeout(
      () =>
        setS((x) => ({
          ...x,
          layers: x.layers.filter((l) => l.key !== exitKey),
        })),
      LEAVE_MS,
    )
    return () => clearTimeout(id)
  }, [exitKey])

  const ev = shown.ev
  React.useLayoutEffect(() => {
    gate.root = root.current
    gate.skip = () =>
      setS((x) => ({ ...x, layers: x.layers.filter((l) => l.role === 'live') }))
    gate.until =
      performance.now() +
      (calm() ? 0 : ARRIVE[ev.round ? 'round' : ev.type] || 0)
    if (t && root.current)
      effect?.(ev, {
        root: root.current,
        exit: root.current.querySelector('.cherrypick-layer.exit'),
        theme: t,
      })
    // once per event, with the theme read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev, t])
  React.useEffect(
    () => () => {
      gate.until = 0
      gate.root = null
      gate.skip = null
    },
    [],
  )

  const live = shown.layers.find((l) => l.role === 'live')
  return (
    <div ref={root} className={`cherrypick-stage ${className}`}>
      {props.renderTop?.(ev)}
      <div className="cherrypick-stack">
        {shown.layers.map((l) => (
          <div
            key={l.key}
            className={`cherrypick-layer ${l.role} ev-${l.role === 'exit' ? 'exit-' + l.exit : l.ev.type}${l.ev.round ? ' ev-round' : ''}`}
            aria-hidden={l.role === 'exit' ? true : undefined}
          >
            {props.renderPair(l, {
              onPick: (id) => l.role === 'live' && gated(() => pick(id)),
              onLook: l.role === 'live' ? onLook : () => {},
            })}
          </div>
        ))}
        {live.ev.round && props.renderBanner ? (
          <React.Fragment key={'banner' + live.key}>
            {props.renderBanner()}
          </React.Fragment>
        ) : null}
      </div>
      {props.renderBottom?.(ev)}
    </div>
  )
}
