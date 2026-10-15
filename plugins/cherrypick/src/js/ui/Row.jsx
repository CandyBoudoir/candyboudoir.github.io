// A Cherry Pick row: Stash's RecommendationRow with the same slider and cards
// as Stash's own front-page rows, so themes style it with no extra work.
// Items are model rows ({ scene } or { performer }, plus a reason); the cards
// come from Stash by id (records.js).
import { components, ReactRouterDOM } from '../runtime/api.js'
import { useStashRecords } from './records.js'

const Slider = window.PluginApi.libraries.ReactSlick.default
const { Link } = ReactRouterDOM

// Stash's own slider settings (src/core/recommendations.ts), which plugins
// cannot import.
function slidesToScroll(cards, show, isTouch) {
  if (isTouch) return 1
  return cards > show ? show : cards
}
export function sliderSettings(cards, isTouch) {
  const at = (show) => ({
    infinite: !isTouch && cards > show,
    slidesToShow: cards > show ? show : cards,
    slidesToScroll: slidesToScroll(cards, show, isTouch),
  })
  return {
    dots: !isTouch,
    arrows: !isTouch,
    speed: 300,
    variableWidth: true,
    swipeToSlide: true,
    ...at(5),
    responsive: [
      { breakpoint: 1909, settings: at(4) },
      { breakpoint: 1542, settings: at(3) },
      { breakpoint: 1170, settings: at(2) },
      { breakpoint: 801, settings: at(1) },
    ],
  }
}

const isTouch = () => window.matchMedia('(pointer: coarse)').matches

export function Row({ id, title, className = '', link, extra, children }) {
  const { RecommendationRow } = components
  return (
    <RecommendationRow
      className={`cherrypick-row cherrypick-row-${id} ${className}`}
      header={title}
      link={
        <div className="recommendation-row-extra">
          {extra}
          {link ? <Link to={link.to}>{link.text}</Link> : null}
        </div>
      }
    >
      {children}
    </RecommendationRow>
  )
}

// A row of Stash cards for model items. renderCard(record, item, index)
// draws one card; while Stash's records load, the row shows Stash's own
// skeleton cards so nothing jumps when they arrive.
export function CardRow({
  kind,
  items,
  renderCard,
  skeleton = 12,
  empty,
  ...row
}) {
  const ids = (items || []).map(
    (it) => (kind === 'scene' ? it.scene : it.performer).id,
  )
  const records = useStashRecords(kind, items ? ids : [])
  const loading = !items || !records
  const skeletonClass =
    kind === 'scene' ? 'scene-skeleton' : 'performer-skeleton'
  let body
  if (loading)
    body = (
      <Slider {...sliderSettings(skeleton, isTouch())}>
        {[...Array(skeleton)].map((_, i) => (
          <div key={i} className={`${skeletonClass} skeleton-card`} />
        ))}
      </Slider>
    )
  else if (!records.length)
    body = empty ? (
      <div className="cherrypick-row-empty text-muted">{empty}</div>
    ) : null
  else {
    const byId = new Map(records.map((r) => [r.id, r]))
    body = (
      <Slider {...sliderSettings(records.length, isTouch())}>
        {items
          .map((it, i) => {
            const rec = byId.get(ids[i])
            return rec ? renderCard(rec, it, i) : null
          })
          .filter(Boolean)}
      </Slider>
    )
  }
  if (!loading && !records.length && !empty) return null
  return <Row {...row}>{body}</Row>
}
