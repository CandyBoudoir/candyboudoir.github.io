// The scene page: "likely 4★ for you" beside Stash's rating stars, and More
// like this under the player. Don't learn lives in a pick's ⋯ menu and in
// "Tags Cherry Pick doesn't learn from", not here: a second button beside
// the stars crowded themes that narrow the toolbar.
//
// Stash has no slot beside the rating (RatingSystem does not know its scene,
// and the toolbar takes no extensions), so the line renders through a portal
// into the toolbar's first group, from a component added after ScenePage.
// More like this renders through a portal too, after the page's .row: themes
// such as Refract lay that row out as a grid locked to the window's height,
// where one more child would take its height from the player.
import { Bootstrap, patchAfter, React, ReactDOM } from '../runtime/api.js'
import { badgeLabel, fmtStars, rateMore, unratedByYou } from '../model/index.js'
import { popularity, performerRankPhrase } from '../model/signals.js'
import { moreLikeThis } from '../model/recs.js'
import { NAME_S } from '../name.js'
import { Safe } from '../ui/Safe.jsx'
import { useAppState } from '../ui/hooks.js'
import { CardRow } from '../ui/Row.jsx'
import { RowSceneCard } from '../ui/rowCards.jsx'
import { ConnectLine } from '../ui/ConnectLine.jsx'
import { StashdbSceneCard } from '../ui/StashdbSceneCard.jsx'
import { stashdbReady, useSceneLookups } from '../stashdb/layer.js'

const { OverlayTrigger, Popover, PopoverContent } = Bootstrap

// ------------------------------------------------------------ beside the stars

function ScoreLine({ scene }) {
  const M = useAppState((s) => s.M)
  const db = useAppState((s) => s.db)
  const settings = useAppState((s) => s.settings)
  if (!settings.sceneLine || !M || !unratedByYou(M, scene)) return null
  // Too few ratings to check a guess: say how many it takes
  if (!M.gate)
    return M.ratingsToGo ? (
      <span
        className="text-muted small cherrypick-rate-more"
        title={`${NAME_S} guess at your rating shows here once it can check its guesses against your ratings.`}
      >
        {rateMore(M, { short: true })} for Your score
      </span>
    ) : null
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

// A node of Cherry Pick's own that place(row) puts into Stash's page, given
// the scene page's .row, for a portal; it leaves with the component. The
// anchor goes in the component's output, inside the row.
function useRowSlot(place) {
  const anchor = React.useRef(null)
  const [slot, setSlot] = React.useState(null)
  React.useLayoutEffect(() => {
    const row = anchor.current?.closest('.row')
    const el = row && place(row)
    if (!el) return
    setSlot({ el, row })
    return () => el.remove()
    // once: the row and the node last as long as the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [<span ref={anchor} hidden />, slot?.el, slot?.row]
}

// Renders into Stash's scene toolbar, beside the rating, through a portal.
// The slot is a div, where Stash wraps each toolbar button in a span: themes
// shape those icon buttons by that place (Refract makes every
// `.scene-toolbar > span > span > button` a 26px circle), and the line is
// text.
function ToolbarExtras({ scene }) {
  const [anchor, slot] = useRowSlot((row) => {
    const group = row.querySelector('.scene-toolbar .scene-toolbar-group')
    if (!group) return null
    const el = document.createElement('div')
    el.className = 'cherrypick-score-line cherrypick-ui'
    group.appendChild(el)
    return el
  })
  return (
    <>
      {anchor}
      {slot ? ReactDOM.createPortal(<ScoreLine scene={scene} />, slot) : null}
    </>
  )
}

// ------------------------------------------------------------ under the player

function MoreLikeThis({ scene }) {
  const s = useAppState((x) => x)
  // StashDB lookups for this scene (its popularity, and the candidates for
  // the row of scenes you don't have)
  const lookups = useSceneLookups(scene)
  if (!s.settings.showMoreLikeThis || !s.M || s.watching) return null
  const dbScene = s.db.scenes.get(scene.id)
  if (!dbScene) return null
  const r = moreLikeThis(s.M, s, dbScene)
  const rowId = 'mlt-' + scene.id
  const card = (id) => (rec, it, i) => (
    <RowSceneCard key={rec.id} scene={rec} item={it} rowId={id} index={i} />
  )
  const missing = s.settings.outOfLibrary
  const ready = stashdbReady(s)
  const missingId = rowId + '-missing'
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
      {missing && ready && lookups !== 'failed' ? (
        <CardRow
          id={missingId}
          title="Not in your library"
          kind="stashdb-scene"
          className="cherrypick-mlt-missing"
          items={
            lookups === 'idle' || lookups === 'loading' ? null : r.notInLibrary
          }
          empty="StashDB has nothing like this one that you don't have."
          renderCard={(rec, it) => (
            <StashdbSceneCard
              key={rec.id}
              scene={rec}
              item={it}
              rowId={missingId}
            />
          )}
        />
      ) : null}
      {missing && !ready ? <ConnectLine /> : null}
    </div>
  )
}

// Renders after the scene page's .row, through a portal, so it sits under
// the player on wide screens and after the scene's details on a phone.
function AfterRow({ children }) {
  const [anchor, slot, row] = useRowSlot((row) => {
    const el = document.createElement('div')
    el.className = 'cherrypick-after-row'
    row.after(el)
    return el
  })
  // The row's side padding, so what renders here lines up with the details
  // and the player: Stash pads the page around the row, but a theme can pad
  // the row instead (Refract does, on the scene page alone)
  React.useLayoutEffect(() => {
    if (!slot) return
    const pad = () => {
      const style = getComputedStyle(row)
      slot.style.paddingLeft = style.paddingLeft
      slot.style.paddingRight = style.paddingRight
    }
    pad()
    window.addEventListener('resize', pad)
    return () => window.removeEventListener('resize', pad)
  }, [slot, row])
  return (
    <>
      {anchor}
      {slot ? ReactDOM.createPortal(children, slot) : null}
    </>
  )
}

export function registerScenePage() {
  // Both go after ScenePage's own output, inside the page's .row, and render
  // where they belong through portals.
  patchAfter('ScenePage', (props, result) => (
    <>
      {result}
      <Safe name="scene toolbar">
        <ToolbarExtras scene={props.scene} />
      </Safe>
      <Safe name="More like this">
        <AfterRow>
          <MoreLikeThis scene={props.scene} />
        </AfterRow>
      </Safe>
    </>
  ))
}
