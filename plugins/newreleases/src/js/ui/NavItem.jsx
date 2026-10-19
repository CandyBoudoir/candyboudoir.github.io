// New Releases in Stash's main menu, after Stash's own entries and in their
// markup (Nav.Link, a minimal button, the menu icon), so themes style it as
// one of them.
import {
  Bootstrap,
  components,
  FontAwesomeSolid,
  ReactRouterDOM,
} from '../api.js'
import { PLUGIN_NAME, PLUGIN_ROUTE } from '../name.js'

const { Button, Nav } = Bootstrap
const { useHistory, useLocation } = ReactRouterDOM
const { faStore } = FontAwesomeSolid

export function NavItem() {
  const { Icon } = components
  const history = useHistory()
  const { pathname } = useLocation()
  const active = pathname === PLUGIN_ROUTE
  return (
    <Nav.Link
      as="div"
      eventKey={PLUGIN_ROUTE}
      className="col-4 col-sm-3 col-md-2 col-lg-auto newreleases-nav"
    >
      <Button
        className={`minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center${active ? ' active' : ''}`}
        onClick={() => history.push(PLUGIN_ROUTE)}
      >
        {Icon ? (
          <Icon
            icon={faStore}
            className="nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0"
          />
        ) : null}
        <span>{PLUGIN_NAME}</span>
      </Button>
    </Nav.Link>
  )
}
