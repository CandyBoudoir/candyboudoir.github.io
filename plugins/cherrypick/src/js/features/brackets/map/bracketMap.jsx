// The bracket map: the whole bracket as a map that stays on screen beside
// the match, with Cherry Pick's cherries as the player's marker. Rounds are
// columns of match nodes joined by paths. A pick flies the winner's
// picture into its place in the next round, draws the path it took in the
// theme's accent and hops the cherries on to the next match while the
// camera follows; a new round pulls the camera back over the whole map.
// Show bracket opens the whole map; one too big to read whole scrolls at
// full size instead (a phone, a 64 bracket).
import { FontAwesomeSolid, React } from '../../../runtime/api.js'
import { Cherries } from '../../../ui/Cherries.jsx'
import { Icon } from '../parts.jsx'
import { calm, fly, fx, haptic, sfx, useTheme } from './fx.js'
import { useFacts } from './sides.jsx'

const { faTrophy } = FontAwesomeSolid

// The map outside a match stage (the champion screen's Show bracket), with
// the theme's colours the stage would give it
export function MapFrame({ className = '', children }) {
  const ref = React.useRef(null)
  useTheme(ref)
  return (
    <div ref={ref} className={`cherrypick-map-stage ${className}`}>
      {children}
    </div>
  )
}

// A stage's title card: a new round, or the Challenge round
export function RoundBanner({ kicker, title, sub }) {
  return (
    <div className="cherrypick-banner" aria-hidden="true">
      <div className="cherrypick-plaque">
        <span className="cherrypick-plaque-kicker">{kicker}</span>
        <span className="cherrypick-plaque-title">{title}</span>
        <span className="cherrypick-plaque-sub">{sub}</span>
      </div>
    </div>
  )
}

export function BracketBanner({ st, cur }) {
  const n = st.rounds[cur.round].filter((m) => !m.bye).length
  return (
    <RoundBanner
      kicker={`Stage ${cur.round + 1} of ${st.rounds.length}`}
      title={st.roundLabel}
      sub={n === 1 ? 'One pick for the crown' : `${n} matches`}
    />
  )
}

// The match a pick decided: the one that held its two entrants
function decided(st, ev) {
  if (ev?.type !== 'pick') return null
  for (let r = 0; r < st.rounds.length; r++)
    for (let i = 0; i < st.rounds[r].length; i++) {
      const m = st.rounds[r][i]
      if (m.a === ev.from[0] && m.b === ev.from[1]) return { r, i }
    }
  return null
}

// The drawn map's geometry, read from its nodes' layout (offsets, which
// the camera's transform leaves alone): each node's box and slot centres,
// and the elbow path out of every match
function measure(world, st) {
  const nodes = {}
  for (const el of world.querySelectorAll('[data-node]')) {
    nodes[el.dataset.node] = {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
      slots: [...el.querySelectorAll('[data-k]')].map(
        (s) => s.offsetTop + s.offsetHeight / 2,
      ),
    }
  }
  const last = st.rounds.length - 1
  const paths = []
  st.rounds.forEach((round, r) =>
    round.forEach((m, i) => {
      const from = nodes[`${r}-${i}`]
      const to = r < last ? nodes[`${r + 1}-${i >> 1}`] : nodes.trophy
      if (!from || !to) return
      const x1 = from.x + from.w
      const y1 = from.y + from.h / 2
      const x2 = to.x
      const y2 =
        r < last ? to.y + (to.slots[i & 1] ?? to.h / 2) : to.y + to.h / 2
      const xm = (x1 + x2) / 2
      paths.push({
        key: `${r}-${i}`,
        r,
        i,
        d: `M${x1} ${y1}H${xm}V${y2}H${x2}`,
        won: !!m.winner,
        bye: m.bye,
        winner: m.winner,
      })
    }),
  )
  return { nodes, paths, w: world.offsetWidth, h: world.offsetHeight }
}

// The whole map shown smaller than this is hard to read: Show bracket
// shows it at full size to scroll through instead
const MIN_FIT = 0.6
// The champion's road lights up one round every STEP ms
const STEP = 260
export const roadMs = (st) => 300 + (st.rounds.length + 1) * STEP

/**
 * @param {object} props
 * @param {object} props.b  the bracket
 * @param {object} props.st  BR.bracketState(b)
 * @param {object|null} props.cur  the match being played
 * @param {object|null} props.ev  the stage's last event
 * @param {boolean} [props.overview]  the whole map, from Show bracket
 * @param {boolean} [props.celebrate]  the champion's road lights up
 */
export function BracketMap({
  b,
  st,
  cur,
  ev,
  overview = false,
  celebrate = false,
}) {
  const facts = useFacts(b.kind)
  const vp = React.useRef(null)
  const world = React.useRef(null)
  const marker = React.useRef(null)
  const [geo, setGeo] = React.useState(null)
  const [wide, setWide] = React.useState(false)
  const wideTimer = React.useRef(0)
  const fresh = decided(st, ev)
  const champion = st.result?.champion
  const last = st.rounds.length - 1

  const key = `${b.decisions.length}:${cur?.round}:${cur?.index}:${overview}`
  React.useLayoutEffect(() => {
    if (world.current) setGeo(measure(world.current, st))
    // the bracket's position says it all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  React.useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (world.current) setGeo(measure(world.current, st))
    })
    ro.observe(vp.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a new round pulls the camera back over the whole map for a moment. A
  // pick in that moment leaves the timer running, so the camera always
  // comes back to the match.
  React.useEffect(() => {
    if (!ev?.round || celebrate || calm()) return
    setWide(true)
    clearTimeout(wideTimer.current)
    wideTimer.current = setTimeout(() => setWide(false), 1000)
  }, [ev, celebrate])
  React.useEffect(() => () => clearTimeout(wideTimer.current), [])

  const fitOf = (g, v) => Math.min(v.clientWidth / g.w, v.clientHeight / g.h, 1)
  const scroll =
    overview && !!geo && !!vp.current && fitOf(geo, vp.current) < MIN_FIT

  // the camera: on the match being played, over the whole map, or along
  // the champion's road
  React.useLayoutEffect(() => {
    const v = vp.current
    const w = world.current
    if (!geo || !v || !w) return
    const node = cur ? geo.nodes[`${cur.round}-${cur.index}`] : null
    if (scroll) {
      w.style.transform = ''
      const at = node || geo.nodes.trophy
      if (at) {
        v.scrollLeft = at.x + at.w / 2 - v.clientWidth / 2
        v.scrollTop = at.y + at.h / 2 - v.clientHeight / 2
      }
    } else {
      const vw = v.clientWidth
      const vh = v.clientHeight
      const fit = fitOf(geo, v)
      let s
      let cx
      let cy
      let ms = null
      if (celebrate && fit < 0.45) {
        // too small to read whole: ride along the road to the trophy
        s = Math.min(1, vh / 260)
        const end = geo.nodes.trophy
        cx = end.x + end.w / 2
        cy = end.y + end.h / 2
        ms = roadMs(st)
      } else if (overview || wide || celebrate || !node) {
        s = fit
        cx = geo.w / 2
        cy = geo.h / 2
      } else {
        s = Math.max(fit, Math.min(1, vh / 260))
        cx = node.x + node.w / 2
        cy = node.y + node.h / 2
      }
      const clamp = (t, view, size) =>
        size * s <= view
          ? (view - size * s) / 2
          : Math.min(0, Math.max(view - size * s, t))
      const tx = clamp(vw / 2 - cx * s, vw, geo.w)
      const ty = clamp(vh / 2 - cy * s, vh, geo.h)
      const delay = ev?.type === 'pick' && !ev.round ? 420 : 0
      w.style.transitionDelay = `${delay}ms`
      w.style.transitionDuration = ms ? `${ms}ms` : ''
      w.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`
    }
    // the cherries move to the match being played, with a hop
    const m = marker.current
    if (m && node) {
      const delay = ev?.type === 'pick' ? 420 : 0
      const at = `${cur.round}-${cur.index}`
      m.style.transitionDelay = `${delay}ms`
      m.style.left = `${node.x + node.w / 2}px`
      m.style.top = `${node.y}px`
      if (m.dataset.at && m.dataset.at !== at && ev?.type === 'pick')
        m.firstChild?.animate(
          [
            { transform: 'translateY(0)' },
            { transform: 'translateY(-28px)', offset: 0.45 },
            { transform: 'translateY(0)' },
          ],
          { duration: 360, delay, easing: 'ease-out' },
        )
      m.dataset.at = at
    }
  }, [geo, overview, wide, celebrate, cur, ev, scroll, st])

  // the champion's road starts on the left at the first round
  const roadDelay = (r) => ({ animationDelay: `${300 + r * STEP}ms` })
  return (
    <div
      className={`cherrypick-map-vp${celebrate ? ' celebrate' : ''}${scroll ? ' scroll' : ''}`}
      ref={vp}
      aria-label="The bracket"
    >
      <div className="cherrypick-map-world" ref={world}>
        {geo ? (
          <svg
            className="cherrypick-map-paths"
            width={geo.w}
            height={geo.h}
            aria-hidden="true"
          >
            {geo.paths.map((p) => {
              const road = celebrate && p.winner === champion
              const isFresh = fresh && fresh.r === p.r && fresh.i === p.i
              return (
                <path
                  key={p.key}
                  d={p.d}
                  pathLength="1"
                  className={`cherrypick-map-path${p.won ? ' won' : ''}${p.bye ? ' bye' : ''}${isFresh ? ' fresh' : ''}${road ? ' road' : ''}`}
                  style={road ? roadDelay(p.r) : undefined}
                />
              )
            })}
          </svg>
        ) : null}
        {st.rounds.map((round, r) => (
          <div className="cherrypick-map-col" key={r}>
            {round.map((m, i) => {
              const now = cur && cur.round === r && cur.index === i
              return (
                <div
                  key={i}
                  data-node={`${r}-${i}`}
                  className={`cherrypick-map-node${now ? ' now' : ''}${m.winner ? ' done' : ''}${m.bye ? ' bye' : ''}`}
                >
                  {[m.a, m.b].map((id, k) => {
                    const f = id ? facts(id) : null
                    const landed =
                      fresh &&
                      r === fresh.r + 1 &&
                      i === fresh.i >> 1 &&
                      k === (fresh.i & 1)
                    const out = m.winner && id && m.winner !== id
                    const champ = celebrate && id && id === champion
                    return (
                      <div
                        key={k}
                        data-k={k}
                        className={`cherrypick-map-slot${out ? ' out' : ''}${m.winner && m.winner === id ? ' in' : ''}${landed ? ' landed' : ''}${champ ? ' champ' : ''}`}
                        style={champ ? roadDelay(r - 1) : undefined}
                      >
                        <span className="cherrypick-map-token">
                          {f?.image ? (
                            <img src={f.image} alt="" loading="lazy" />
                          ) : null}
                        </span>
                        <span className="cherrypick-map-label">
                          {f ? f.name : m.bye ? 'bye' : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
        <div className="cherrypick-map-col cherrypick-map-col-trophy">
          <div
            data-node="trophy"
            className={`cherrypick-map-trophy${champion ? ' won' : ''}`}
            style={celebrate ? roadDelay(last + 1) : undefined}
            title={champion ? facts(champion).name : 'The champion'}
          >
            <Icon icon={faTrophy} />
          </div>
        </div>
        {cur ? (
          <span
            className="cherrypick-map-marker"
            ref={marker}
            aria-hidden="true"
          >
            <span className="cherrypick-map-hop">
              <Cherries />
            </span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

// A pick's sounds and flight: the winner's picture flies into its place
// in the next round (one in a new round skips the flight: the camera is
// pulling back), the cherries hop on
export function mapEffect(ev, { root, exit, theme }) {
  const accent = theme.accent
  if (ev.type === 'pick') {
    sfx('coin')
    haptic(12)
    const art = exit?.querySelector(
      '.is-won .cherrypick-map-art, .is-won .cherrypick-cont-img',
    )
    const target = ev.round
      ? null
      : root.querySelector('.cherrypick-map-slot.landed .cherrypick-map-token')
    if (art && target)
      fly(art, target).then(() => {
        if (target.isConnected) fx.puff(target, accent)
      })
    sfx('pop', 160)
    sfx('hop', 420)
    if (ev.round) sfx('round', 300)
  } else if (ev.type === 'undo') sfx('rewind')
  else if (ev.round) sfx('round', 100)
}
