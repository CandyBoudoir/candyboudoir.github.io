// Brackets: single-elimination games that feed the taste model. Bracket and
// Options beside the Performers and Scenes lists, the dialogs (setup, Set
// genders, play, champion, Apply) and the resume pill.
import { store } from '../../runtime/app.js'
import { registerDialog } from '../../ui/dialogs.jsx'
import { pauseBracket, VIEWS } from './actions.js'
import { registerListOps } from './listOps.jsx'
import { PlayDialog } from './play.jsx'
import { ApplyDialog, ResultDialog } from './results.jsx'
import { ClipSetup, GenderGrid, SetupSheet } from './setup.jsx'

export { ResumePill } from './parts.jsx'

const OURS = new Set(Object.values(VIEWS))

export function registerBrackets() {
  registerDialog(VIEWS.setup, SetupSheet)
  registerDialog(VIEWS.clipSetup, ClipSetup)
  registerDialog(VIEWS.genders, GenderGrid)
  registerDialog(VIEWS.play, PlayDialog)
  registerDialog(VIEWS.result, ResultDialog)
  registerDialog(VIEWS.apply, ApplyDialog)
  registerListOps()
  // Nothing during playback: a bracket dialog still open when the player
  // starts closes, and a bracket in play pauses
  store.subscribe((next, prev) => {
    if (!next.watching || prev.watching || !OURS.has(next.dialog?.view)) return
    if (next.dialog.view === VIEWS.play) pauseBracket()
    else store.set({ dialog: null })
  })
}
