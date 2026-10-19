// New Releases' entry point: Stash loads this bundle as a classic script
// after window.PluginApi exists. The route and the menu entry are
// registered at once, before Stash renders the pages they hook.
import { patch, register } from './api.js'
import { PLUGIN_ROUTE } from './name.js'
import { NavItem } from './ui/NavItem.jsx'
import { NewReleasesPage } from './ui/Page.jsx'
import { Safe } from './ui/Safe.jsx'

register.route(PLUGIN_ROUTE, NewReleasesPage)

// Stash's menu renders its entries as the children of MainNavBar.MenuItems;
// the entry joins them there, as Stash's own route registration joins its
// routes.
patch.before('MainNavBar.MenuItems', (props) => [
  {
    ...props,
    children: (
      <>
        {props.children}
        <Safe name="the menu entry">
          <NavItem />
        </Safe>
      </>
    ),
  },
])
