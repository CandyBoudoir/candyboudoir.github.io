// Your score in the rating corner of unrated scene cards, wherever Stash
// draws a scene card. Stash's own RatingBanner sits in SceneCard.Image, so
// the badge goes there too, in the same markup (.rating-banner) so themes
// style it, outlined to set it apart from a real rating.
import { patch } from '../runtime/api.js'
import { badgeLabel, fmtStars } from '../model/index.js'
import { NAME_S } from '../name.js'
import { useModel, useSettings } from '../ui/hooks.js'
import { Safe } from '../ui/Safe.jsx'

// A Your score for this scene right now, or null: unrated scenes only, once
// the model is ready and beats the user's average on held-out ratings.
export function scoreFor(M, scene, relative) {
  if (!M?.gate || scene.rating100 != null) return null
  const p = M.prediction(scene.id)
  if (!p) return null
  return { value: p.value, label: badgeLabel(M, p.value, relative) }
}

function ScoreCorner({ scene }) {
  const M = useModel()
  const settings = useSettings()
  if (!settings.badges) return null
  const s = scoreFor(M, scene, settings.relativeBadges)
  if (!s) return null
  const r = M.reason(scene.id)
  const title = `Your score ${fmtStars(s.value)}★${r ? ': ' + r.text : ''}. ${NAME_S} guess; never written to your rating.`
  return (
    <div
      className="rating-banner cherrypick-score-banner cherrypick-ui"
      title={title}
    >
      {s.label.corner}
      {s.label.relative ? null : <span className="cherrypick-star">★</span>}
    </div>
  )
}

export function registerScoreBadge() {
  patch.after('SceneCard.Image', (props, _, result) => (
    <>
      {result}
      <Safe name="score badge">
        <ScoreCorner scene={props.scene} />
      </Safe>
    </>
  ))
}
