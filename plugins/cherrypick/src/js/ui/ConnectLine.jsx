// The one line shown where scenes you don't have would be, when Stash has
// no StashDB key. The button opens the Connect StashDB dialog.
import { openDialog } from './dialogs.jsx'

export function ConnectLine() {
  return (
    <div className="cherrypick-connect-line cherrypick-ui">
      <span className="text-muted">
        Connect StashDB to see what you&apos;re missing.
      </span>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => openDialog({ view: 'connect' })}
      >
        Connect StashDB
      </button>
    </div>
  )
}
