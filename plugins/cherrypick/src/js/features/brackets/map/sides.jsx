// A match on the bracket map: its two sides, as cards. They keep the
// classic match's classes (cherrypick-match, cherrypick-contender,
// cherrypick-cont-title), so what reads a match reads both. A card shows
// no rating, seed or rating-based reason; a scene is its contact sheet.
import { FontAwesomeSolid } from '../../../runtime/api.js'
import { useAppState } from '../../../ui/hooks.js'
import { fmtDuration } from '../../../ui/StashdbSceneCard.jsx'
import { SceneContender } from '../judge.jsx'
import { Icon, plural } from '../parts.jsx'

const { faCrown } = FontAwesomeSolid

// An entrant's name, picture and one line of facts a pick may lean on: a
// performer's scene count; a scene's studio, year and length
export function useFacts(kind) {
  const M = useAppState((s) => s.M)
  return (id) => {
    if (!M || !id) return { name: '', image: null, line: '' }
    if (kind === 'performer') {
      const p = M.db.performers.get(id)
      const n = p?.local?.scene_count ?? p?.ownedSceneIds?.length ?? 0
      return {
        name: p?.name || 'A removed performer',
        image: p?.image || null,
        line: `${n} ${plural(n, 'scene')}`,
      }
    }
    const s = M.db.scenes.get(id)
    return {
      name: s?.title || 'A removed scene',
      image: s?.image || null,
      line: [s?.studio?.name, s?.date?.slice(0, 4), fmtDuration(s?.duration)]
        .filter(Boolean)
        .join(' · '),
    }
  }
}

// What a side of a layer is doing: arriving, won, lost or going back
export function sideState(layer, id) {
  if (layer.role === 'live') return 'enter'
  if (layer.exit === 'undo') return 'rewind'
  return layer.winner === id ? 'won' : 'lost'
}

const Crown = () => (
  <span className="cherrypick-crown text-warning" title="The champion">
    <Icon icon={faCrown} />
  </span>
)

// crown: the champion's id in its Challenge round
export function MapPair({ kind, layer, onPick, onLook, crown = null }) {
  const facts = useFacts(kind)
  return (
    <div className={`cherrypick-match cherrypick-map-encounter ${kind}`}>
      {[layer.a, layer.b].map((id, i) => {
        const side = i ? 'right' : 'left'
        const state = sideState(layer, id)
        if (kind === 'clip')
          return (
            <div
              key={id}
              className={`cherrypick-map-side side-${side} is-${state}`}
            >
              <SceneContender
                id={id}
                side={side}
                onPick={() => onPick(id)}
                onLook={(frame) => onLook(id, frame)}
              />
              {crown === id ? <Crown /> : null}
            </div>
          )
        const f = facts(id)
        return (
          <button
            key={id}
            type="button"
            className={`card cherrypick-contender performer cherrypick-map-side side-${side} is-${state}`}
            onClick={() => onPick(id)}
            aria-label={`Pick ${f.name}`}
          >
            <span className="cherrypick-cont-img cherrypick-map-art">
              {f.image ? <img src={f.image} alt="" draggable="false" /> : null}
              <span className="cherrypick-key badge badge-dark">
                {side === 'left' ? '←' : '→'}
              </span>
              {crown === id ? <Crown /> : null}
            </span>
            <span className="cherrypick-cont-body">
              <span className="cherrypick-cont-title">{f.name}</span>
              <span className="small text-muted">{f.line}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
