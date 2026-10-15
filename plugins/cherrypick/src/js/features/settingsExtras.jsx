// Under Cherry Pick's settings in Settings › Plugins: the remembered bracket
// gender with Forget, and a link to the plugin page. Rows use Stash's own
// Setting component, so they look like the switches above them.
//
// Stash's Settings page writes back the configuration it loaded whenever a
// switch changes, so Cherry Pick's own writes wait until the user leaves the
// page (storage/tier1.js). Forget changes the store now and says so.
import {
  Bootstrap,
  components,
  patch,
  React,
  ReactRouterDOM,
} from '../runtime/api.js'
import { store } from '../runtime/app.js'
import { genderLabel } from '../model/util.js'
import { inManifestOrder } from '../storage/settings.js'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ROUTE } from '../name.js'
import { useAppState } from '../ui/hooks.js'
import { Safe } from '../ui/Safe.jsx'

const { Button } = Bootstrap

// New brackets start from the largest pool again.
const forgetBracketGender = () =>
  store.set((s) => ({
    bracketPrefs: { ...(s.bracketPrefs || {}), gender: null },
  }))

function BracketGender() {
  const gender = useAppState((s) => s.bracketPrefs?.gender ?? null)
  // Forget was used on this visit: the row stays to say when it saves
  const [forgot, setForgot] = React.useState(false)
  const { Setting } = components
  const id = `plugin-${PLUGIN_ID}-bracket-gender`
  if (gender)
    return (
      <Setting
        id={id}
        className="cherrypick-ui"
        heading={`Bracket gender: ${genderLabel(gender) || gender}`}
        subHeading="Remembered from your last bracket. Forget it and brackets start from your largest pool."
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setForgot(true)
            forgetBracketGender()
          }}
        >
          Forget
        </Button>
      </Setting>
    )
  if (!forgot) return null
  return (
    <Setting
      id={id}
      className="cherrypick-ui"
      heading="Bracket gender: forgotten"
      subHeading={
        <>
          Brackets start from your largest pool.{' '}
          <span className="d-block text-warning">
            Saved when you leave Settings: Stash&apos;s Settings page would
            overwrite it now.
          </span>
        </>
      }
    />
  )
}

function PageLink() {
  const { Setting } = components
  const { Link } = ReactRouterDOM
  return (
    <Setting
      id={`plugin-${PLUGIN_ID}-page`}
      className="cherrypick-ui"
      heading={`${PLUGIN_NAME} page`}
      subHeading={`How well Your score is doing, the full Hall of Fame, StashDB, what you hid, and Remove ${PLUGIN_NAME} data.`}
    >
      <Link className="btn btn-secondary btn-sm" to={PLUGIN_ROUTE}>
        Open
      </Link>
    </Setting>
  )
}

export function registerSettingsExtras() {
  patch.before('PluginSettings', (props, ...rest) =>
    props?.pluginID === PLUGIN_ID && Array.isArray(props.settings)
      ? [{ ...props, settings: inManifestOrder(props.settings) }, ...rest]
      : [props, ...rest],
  )
  patch.after('PluginSettings', (props, _, result) => {
    if (props.pluginID !== PLUGIN_ID) return result
    const rows = (
      <Safe key="cherrypick-settings-extras" name="settings extras">
        <BracketGender />
        <PageLink />
      </Safe>
    )
    // Inside Stash's .plugin-settings, after the last switch, so its
    // dividers run on; beside it if another plugin changed what it renders.
    if (React.isValidElement(result) && result.type === 'div')
      return React.cloneElement(
        result,
        undefined,
        ...React.Children.toArray(result.props.children),
        rows,
      )
    return (
      <>
        {result}
        <div className="plugin-settings">{rows}</div>
      </>
    )
  })
}
