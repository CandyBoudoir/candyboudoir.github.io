// Stash's own loading indicator, so each theme's loader restyles it (Juicy's
// is a gum bubble) and its wording. When the page opens before Stash has
// registered the component, the same markup.
import { components } from '../api.js'

export function Loading({ message, inline = false, small = false }) {
  const Indicator = components.LoadingIndicator
  if (Indicator)
    return <Indicator message={message} inline={inline} small={small} />
  const classes = ['LoadingIndicator', inline && 'inline', small && 'small']
  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <div
        className={`spinner-border${small ? ' spinner-border-sm' : ''}`}
        role="status"
      >
        <span className="sr-only">Loading…</span>
      </div>
      {message !== '' ? (
        <h4 className="LoadingIndicator-message">{message ?? 'Loading…'}</h4>
      ) : null}
    </div>
  )
}
