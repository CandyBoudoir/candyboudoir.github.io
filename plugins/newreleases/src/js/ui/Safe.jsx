// The page and the navbar entry render inside Safe, so an error in the
// plugin removes only its own piece and never takes Stash's page down with
// it. The page shows what went wrong in its place.
import { React } from '../api.js'
import { PLUGIN_ID } from '../name.js'

export class Safe extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(
      `${PLUGIN_ID}: ${this.props.name || 'a piece'} failed`,
      error,
      info?.componentStack,
    )
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return this.props.fallback ? this.props.fallback(error) : null
  }
}
