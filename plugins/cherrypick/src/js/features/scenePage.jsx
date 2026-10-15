// The scene page: "likely 4★ for you" and Don't learn beside Stash's rating
// stars, and More like this under the player.
//
// Stash has no slot beside the rating (RatingSystem does not know its scene,
// and the toolbar takes no extensions), so the line renders through a portal
// into the toolbar's first group, from a component added after ScenePage.
import { Bootstrap, patch, React, ReactDOM } from '../runtime/api.js'
import { toggleDontLearn, isDontLearn } from '../runtime/actions.js'
import { badgeLabel, fmtStars } from '../model/index.js'
import { popularity, performerRankPhrase } from '../model/signals.js'
import { moreLikeThis } from '../model/recs.js'
import { NAME_S, PLUGIN_NAME } from '../name.js'
import { Safe } from '../ui/Safe.jsx'
import { useAppState } from '../ui/hooks.js'
import { CardRow } from '../ui/Row.jsx'
import { RowSceneCard } from '../ui/rowCards.jsx'
import { ConnectLine } from '../ui/ConnectLine.jsx'

const { OverlayTrigger, Popover, PopoverContent } = Bootstrap

// ------------------------------------------------------------ beside the stars

function ScoreLine({ scene }) {
  const M = useAppState((s) => s.M)
  const db = useAppState((s) => s.db)
  const settings = useAppState((s) => s.settings)
  if (!settings.sceneLine || !M?.gate || scene.rating100 != null) return null
  const p = M.prediction(scene.id)
  if (!p) return null
  const label = badgeLabel(M, p.value, settings.relativeBadges)
  const r = M.reason(scene.id)
  const dbScene = db?.scenes.get(scene.id)
  const pop = dbScene && db.hasStashdb ? popularity(db, dbScene) : null
  const rank = pop ? performerRankPhrase(pop) : null
  const popover = (
    <Popover
      id={`cherrypick-line-${scene.id}`}
      className="cherrypick-line-popover"
    >
      <PopoverContent>
        <span className="d-block">
          {r?.text || 'A lot like scenes you rate well'}.
        </span>
        {pop?.held ? (
          <span className="d-block text-muted small">
            {pop.held}
            {rank ? ` · ${rank}` : ''}
          </span>
        ) : null}
        <span className="d-block text-muted small">
          {NAME_S} guess ({fmtStars(p.value)}★). It never touches your rating.
        </span>
      </PopoverContent>
    </Popover>
  )
  return (
    <OverlayTrigger
      trigger={['hover', 'focus', 'click']}
      placement="bottom"
      rootClose
      overlay={popover}
    >
      <button
        type="button"
        className="btn btn-link text-muted cherrypick-line-button"
      >
        {label.line}
      </button>
    </OverlayTrigger>
  )
}

function DontLearn({ scene }) {
  const on = useAppState((s) => isDontLearn(s, scene.id))
  return (
    <button
      type="button"
      className={`btn btn-link btn-sm cherrypick-line-button cherrypick-dont-learn ${on ? 'text-warning' : 'text-muted'}`}
      aria-pressed={on}
      title={
        on
          ? `${PLUGIN_NAME} ignores this scene's plays, rating and picks. Click to learn from it again.`
          : `Keep this scene's plays, rating and picks out of ${NAME_S} picks`
      }
      onClick={() => toggleDontLearn(scene)}
    >
      {on ? 'Not learning from this · undo' : "Don't learn from this"}
    </button>
  )
}

// Renders into Stash's scene toolbar, beside the rating, through a portal.
function ToolbarExtras({ scene }) {
  const anchor = React.useRef(null)
  const [slot, setSlot] = React.useState(null)
  React.useLayoutEffect(() => {
    const group = anchor.current
      ?.closest('.row')
      ?.querySelector('.scene-toolbar .scene-toolbar-group')
    if (!group) return
    const el = document.createElement('span')
    el.className = 'cherrypick-score-line cherrypick-ui'
    group.appendChild(el)
    setSlot(el)
    return () => el.remove()
  }, [])
  return (
    <>
      <span ref={anchor} hidden />
      {slot
        ? ReactDOM.createPortal(
            <>
              <ScoreLine scene={scene} />
              <DontLearn scene={scene} />
            </>,
            slot,
          )
        : null}
    </>
  )
}

// ------------------------------------------------------------ under the player

function MoreLikeThis({ scene }) {
  const s = useAppState((x) => x)
  if (!s.settings.showMoreLikeThis || !s.M || s.watching) return null
  const dbScene = s.db.scenes.get(scene.id)
  if (!dbScene) return null
  const r = moreLikeThis(s.M, s, dbScene)
  const rowId = 'mlt-' + scene.id
  const card = (id) => (rec, it, i) => (
    <RowSceneCard key={rec.id} scene={rec} item={it} rowId={id} index={i} />
  )
  const missing = s.settings.outOfLibrary
  return (
    <div className="cherrypick-more-like-this recommendations-container cherrypick-ui">
      <div className="recommendation-row-head cherrypick-mlt-head">
        <div>
          <h2>More like this</h2>
        </div>
      </div>
      <CardRow
        id={rowId}
        title="In your library"
        kind="scene"
        className="cherrypick-mlt-owned"
        items={r.inLibrary}
        empty="Nothing like this one that you haven't watched yet."
        renderCard={card(rowId)}
      />
      {missing && s.stashdb && s.db.hasStashdb ? (
        <CardRow
          id={rowId + '-missing'}
          title="Not in your library"
          kind="stashdb-scene"
          className="cherrypick-mlt-missing"
          items={r.notInLibrary}
          empty="StashDB has nothing like this one that you don't have."
          renderCard={card(rowId + '-missing')}
        />
      ) : null}
      {missing && !s.stashdb ? <ConnectLine /> : null}
    </div>
  )
}

export function registerScenePage() {
  // Both go after ScenePage's own output, inside the page's .row; CSS orders
  // More like this last and full width, so it sits under the player on wide
  // screens and after the scene's details on a phone.
  patch.after('ScenePage', (props, _, result) => (
    <>
      {result}
      <Safe name="scene toolbar">
        <ToolbarExtras scene={props.scene} />
      </Safe>
      <Safe name="More like this">
        <MoreLikeThis scene={props.scene} />
      </Safe>
    </>
  ))
}
