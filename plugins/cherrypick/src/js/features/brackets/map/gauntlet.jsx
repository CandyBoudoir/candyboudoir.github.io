// The Challenge round's map: the champion's road past up to three of the
// user's favorites to the trophy. A favorite shows only once the champion
// reaches it; one beaten greys out with a tick, and the cherries drop in on
// the next. Beating them all lights the trophy (the champion screen then
// plays its moment).
import { FontAwesomeSolid, React } from '../../../runtime/api.js'
import { Cherries } from '../../../ui/Cherries.jsx'
import { Icon } from '../parts.jsx'
import { fx, haptic, sfx } from './fx.js'
import { RoundBanner } from './bracketMap.jsx'
import { useFacts } from './sides.jsx'

const { faCheck, faCrown, faTrophy } = FontAwesomeSolid

export function ChallengeBanner({ n }) {
  return (
    <RoundBanner
      kicker="Challenge round"
      title="Champion vs favorites"
      sub={
        n === 1
          ? 'Beat your favorite for the trophy'
          : `Beat all ${n} of your favorites for the trophy`
      }
    />
  )
}

/**
 * @param {object} props
 * @param {object} props.b  the finished bracket
 * @param {object} props.cs  BR.challengeState(b)
 * @param {boolean} [props.celebrate]  the road lights up to the trophy
 */
export function Gauntlet({ b, cs, celebrate = false }) {
  const facts = useFacts(b.kind)
  const champ = facts(b.result.champion)
  const at = cs.beaten.length
  const step = (i) =>
    celebrate ? { animationDelay: `${300 + i * 260}ms` } : undefined
  return (
    <div
      className={`cherrypick-gauntlet${celebrate ? ' celebrate' : ''}`}
      aria-label="The Challenge round"
    >
      <div className="cherrypick-gauntlet-node champion">
        <span className="cherrypick-map-token">
          {champ.image ? <img src={champ.image} alt="" /> : null}
        </span>
        <span className="cherrypick-gauntlet-badge text-warning">
          <Icon icon={faCrown} />
        </span>
        <span className="cherrypick-map-label">{champ.name}</span>
      </div>
      {cs.rungs.map((id, i) => {
        const beaten = i < at
        const now = !celebrate && i === at && !cs.done
        const f = beaten || now || celebrate ? facts(id) : null
        return (
          <React.Fragment key={id}>
            <span
              className={`cherrypick-gauntlet-link${beaten ? ' lit' : ''}${now ? ' now' : ''}`}
              style={step(i)}
            />
            <div
              className={`cherrypick-gauntlet-node${beaten ? ' beaten' : ''}${now ? ' now' : ''}${f ? '' : ' hidden'}`}
              style={step(i)}
            >
              <span className="cherrypick-map-token">
                {f?.image ? <img src={f.image} alt="" /> : f ? null : '?'}
              </span>
              {beaten ? (
                <span className="cherrypick-gauntlet-badge">
                  <Icon icon={faCheck} />
                </span>
              ) : null}
              <span className="cherrypick-map-label">
                {f ? f.name : `Favorite ${i + 1}`}
              </span>
              {now ? (
                // drops in with a hop wherever the champion has got to
                <span className="cherrypick-map-marker" aria-hidden="true">
                  <span className="cherrypick-map-hop">
                    <Cherries />
                  </span>
                </span>
              ) : null}
            </div>
          </React.Fragment>
        )
      })}
      <span
        className={`cherrypick-gauntlet-link${cs.won ? ' lit' : ''}`}
        style={step(cs.rungs.length)}
      />
      <div
        className={`cherrypick-gauntlet-node trophy${cs.won ? ' won' : ''}`}
        style={step(cs.rungs.length + 1)}
      >
        <span className="cherrypick-map-token">
          <Icon icon={faTrophy} />
        </span>
        <span className="cherrypick-map-label">Trophy</span>
      </div>
    </div>
  )
}

// A Challenge round pick: sparks on the favorite the champion got past,
// or from the champion when the road is hidden (the line size); the
// round's end opens the champion screen, which has its own moment
export function gauntletEffect(ev, { root, exit, theme }) {
  if (ev.type === 'pick') {
    sfx('coin')
    haptic(12)
    const beaten = root.querySelectorAll('.cherrypick-gauntlet-node.beaten')
    const last =
      beaten[beaten.length - 1] ||
      exit?.querySelector(
        '.is-won .cherrypick-map-art, .is-won .cherrypick-cont-img',
      )
    if (last) fx.burst(last, theme.accent, { n: 18, speed: 300, life: 380 })
    sfx('pop', 160)
    sfx('hop', 300)
  } else if (ev.type === 'undo') sfx('rewind')
  else if (ev.round) sfx('round', 100)
}
