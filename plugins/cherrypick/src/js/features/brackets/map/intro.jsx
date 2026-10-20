// The champion screen's moment, played once before its podium, results and
// ratings: a bracket won (the champion's road lights up across the map to
// the trophy) or a Challenge round won (the road past every favorite). A
// click, a key or a controller button skips it.
import { React } from '../../../runtime/api.js'
import * as BR from '../../../model/brackets.js'
import { fx, haptic, sfx, useGamepad, useTheme } from './fx.js'
import { BracketMap, roadMs } from './bracketMap.jsx'
import { Gauntlet } from './gauntlet.jsx'
import { useFacts } from './sides.jsx'
import { plural } from '../parts.jsx'

// How long the moment stays after its climax
const AFTER = 1900

function Word({ text, from }) {
  return (
    <span className="cherrypick-intro-word" aria-hidden="true">
      {[...text].map((c, i) => (
        <span key={i} style={{ animationDelay: `${from + i * 45}ms` }}>
          {c}
        </span>
      ))}
    </span>
  )
}

/**
 * @param {object} props
 * @param {object} props.b  the finished bracket
 * @param {'champion'|'trophy'} props.moment
 * @param {() => void} props.onDone
 */
export function Intro({ b, moment, onDone }) {
  const ref = React.useRef(null)
  const t = useTheme(ref)
  const facts = useFacts(b.kind)
  const champ = b.result.champion
  const f = facts(champ)
  const st = React.useMemo(() => BR.bracketState(b), [b])
  const cs = React.useMemo(() => BR.challengeState(b), [b])
  const trophy = moment === 'trophy' && !!cs
  const climax = trophy ? 300 + (cs.rungs.length + 1) * 260 : roadMs(st)

  const done = React.useRef(onDone)
  done.current = onDone
  const finish = React.useCallback(() => done.current(), [])

  // any key or click skips it; Esc too, so it doesn't close the dialog
  React.useEffect(() => {
    const key = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      e.stopPropagation()
      e.preventDefault()
      if (e.type === 'keydown') finish()
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('keypress', key, true)
    const id = setTimeout(finish, climax + AFTER)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('keypress', key, true)
      clearTimeout(id)
    }
  }, [finish, climax])
  // a button still held from the last pick doesn't skip it
  const born = React.useRef(performance.now())
  useGamepad(true, {
    any: () => performance.now() - born.current > 600 && finish(),
  })

  React.useEffect(() => {
    if (!t) return
    const steps = trophy ? cs.rungs.length + 1 : st.rounds.length
    const timers = []
    for (let i = 0; i <= steps; i++)
      timers.push(setTimeout(() => sfx('hop'), 300 + i * 260))
    timers.push(
      setTimeout(() => {
        sfx('fanfare')
        haptic([20, 50, 20, 50, 40])
        const el = ref.current
        const goal = el?.querySelector(
          '.cherrypick-map-trophy, .cherrypick-gauntlet-node.trophy',
        )
        if (goal) fx.burst(goal, t.accent, { n: 60, speed: 600, life: 700 })
        const box = el?.closest('.modal-content')
        if (box) fx.confetti(t.accent, box)
      }, climax),
    )
    return () => timers.forEach(clearTimeout)
  }, [t, trophy, cs, st, climax])

  const wins = b.decisions.filter((d) => d.winner === champ).length
  const sub = trophy
    ? `Beat ${cs.rungs.length === 1 ? 'your favorite' : `all ${cs.rungs.length} of your favorites`}`
    : `${wins} ${plural(wins, 'win')} · ${b.poolLabel}`
  return (
    <div
      ref={ref}
      className={`cherrypick-intro kind-${b.kind}`}
      onClick={finish}
      role="button"
      tabIndex={-1}
      aria-label={`${f.name} ${trophy ? 'takes the trophy' : 'wins the bracket'}. Click to go on.`}
    >
      <Word text={trophy ? 'Trophy' : 'Champion'} from={climax - 300} />
      <div className="cherrypick-intro-map">
        {trophy ? (
          <Gauntlet b={b} cs={cs} celebrate />
        ) : (
          <BracketMap b={b} st={st} cur={null} ev={null} celebrate />
        )}
      </div>
      <span
        className="cherrypick-intro-name"
        style={{ animationDelay: `${climax + 150}ms` }}
      >
        {f.name}
      </span>
      <span
        className="cherrypick-intro-sub text-muted"
        style={{ animationDelay: `${climax + 300}ms` }}
      >
        {sub}
      </span>
      <span className="cherrypick-intro-skip small text-muted">
        Click or press any key
      </span>
    </div>
  )
}
