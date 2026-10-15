// Cherry Pick on Stash's performer pages and cards: the For you line among
// the performer's details, and a crown or medal on the photo of bracket
// champions and finalists.
//
// PerformerDetailsPanel renders one DetailGroup, a .detail-group holding
// every detail item, so the line goes inside it, last, in Stash's own
// detail-item markup. PerformerCard.Overlays holds the favourite heart (top
// right), the rating banner (top left), the country flag (bottom right) and,
// when Stash's "show links on performer cards" is on, the links (bottom
// left); the crown sits bottom left and steps aside for the links (CSS).
import { components, FontAwesomeSolid, patch, React } from '../runtime/api.js'
import { Cherries } from '../ui/Cherries.jsx'
import { useAppState } from '../ui/hooks.js'
import { Safe } from '../ui/Safe.jsx'
import { honoursMark, honoursOf, performerLineFor } from './performerLine.js'

function ForYouLine({ performer, fullWidth }) {
  const show = useAppState((s) => s.settings.performerLine)
  const watching = useAppState((s) => s.watching)
  const M = useAppState((s) => s.M)
  const history = useAppState((s) => s.brackets.history)
  if (!show || watching) return null
  const text = performerLineFor(M, history, performer)
  if (!text) return null
  // Stash's DetailItem: the label, then a colon in the full-width layout.
  return (
    <div className="detail-item cherrypick-for-you cherrypick-ui">
      <span className="detail-item-title cherrypick-for-you">
        For you <Cherries />
        {fullWidth ? ':' : ''}
      </span>
      <span className="detail-item-value cherrypick-for-you">{text}</span>
    </div>
  )
}

function Honours({ performer }) {
  const show = useAppState((s) => s.settings.medals)
  const history = useAppState((s) => s.brackets.history)
  if (!show) return null
  const mark = honoursMark(honoursOf(history)[performer.id])
  if (!mark) return null
  const { Icon } = components
  const { faCrown, faMedal } = FontAwesomeSolid
  const champion = mark.kind === 'champion'
  return (
    <div
      className={`cherrypick-honours cherrypick-ui ${champion ? 'text-warning' : 'text-light'}`}
      title={mark.title}
    >
      <Icon icon={champion ? faCrown : faMedal} />
      {mark.count ? <small>{mark.count}</small> : null}
    </div>
  )
}

export function registerPerformers() {
  patch.after('PerformerDetailsPanel.DetailGroup', (props, _, result) => {
    if (!props.performer) return result
    const line = (
      <Safe key="cherrypick-for-you" name="For you line">
        <ForYouLine performer={props.performer} fullWidth={props.fullWidth} />
      </Safe>
    )
    // Inside Stash's .detail-group, after its last item; beside it if
    // another plugin changed what the group renders.
    if (React.isValidElement(result) && result.type === 'div')
      return React.cloneElement(
        result,
        undefined,
        ...React.Children.toArray(result.props.children),
        line,
      )
    return (
      <>
        {result}
        {line}
      </>
    )
  })

  patch.after('PerformerCard.Overlays', (props, _, result) => (
    <>
      {result}
      <Safe name="crowns and medals">
        <Honours performer={props.performer} />
      </Safe>
    </>
  ))
}
