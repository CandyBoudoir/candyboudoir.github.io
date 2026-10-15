// Cherry Pick's entry point: Stash loads this bundle as a classic script after
// window.PluginApi exists. Patches and the route are registered at once, so
// they are in place before Stash renders the pages they hook; the plugin's
// data then loads in the background (runtime/app.js).
import { boot } from './runtime/app.js'
import { keepModelCurrent } from './runtime/engine.js'
import { watchPlayback } from './runtime/watching.js'
import { registerRowCards } from './ui/rowCards.jsx'
import { registerScoreBadge } from './features/scoreBadge.jsx'
import { registerFrontPage } from './features/frontPage.jsx'
import { registerScenePage } from './features/scenePage.jsx'
import { registerNavbar } from './features/navbar.jsx'
import { registerPluginPage } from './features/pluginPage.jsx'

registerRowCards()
registerScoreBadge()
registerFrontPage()
registerScenePage()
registerNavbar()
registerPluginPage()

keepModelCurrent()
watchPlayback()
boot()
