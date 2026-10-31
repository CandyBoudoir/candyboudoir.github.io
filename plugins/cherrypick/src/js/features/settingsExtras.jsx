// Under Cherry Pick's settings in Settings › Plugins: the offer beside Stash
// Curator, the remembered bracket gender with Forget, and a link to the
// plugin page. Rows use Stash's own Setting component, so they look like the
// switches above them. Among the switches, Reasons on cards is a drop-down
// in place of Stash's text box.
//
// Stash's Settings page writes back the configuration it loaded whenever a
// switch changes, so Cherry Pick's own writes wait until the user leaves the
// page (storage/tier1.js). Forget changes the store now and says so. The
// Curator offer saves through the page itself, so the switch it turns off
// flips above it and no later toggle undoes it.
import {
  Bootstrap,
  components,
  hooks,
  patch,
  patchAfter,
  React,
  ReactRouterDOM,
} from '../runtime/api.js'
import { store } from '../runtime/app.js'
import { answerCuratorOffer } from '../runtime/actions.js'
import { answerSettings } from '../model/curator.js'
import { genderLabel } from '../model/util.js'
import {
  inManifestOrder,
  reasonDisplayOf,
  SETTING_DEFAULTS,
  SETTING_KEYS,
} from '../storage/settings.js'
import { withCuratorAnswer } from '../storage/tier1.js'
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ROUTE } from '../name.js'
import { useAppState } from '../ui/hooks.js'
import { Safe } from '../ui/Safe.jsx'
import { OFFER, useCuratorOffer } from './curatorOffer.js'

const { Button, Form } = Bootstrap

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

// Beside Stash Curator, the offer to hide Your score on cards
// (curatorOffer.js), saved the way the switches above save: Stash's
// Settings page holds this plugin's map, and its savePluginSettings writes
// it and moves the switch.
function CuratorOffer() {
  const { plugins, savePluginSettings } = hooks.useSettings()
  const map = plugins?.[PLUGIN_ID] || {}
  const show = useCuratorOffer(map.badges ?? SETTING_DEFAULTS.badges)
  const { Setting } = components
  if (!show) return null
  const answer = (a) => {
    savePluginSettings(PLUGIN_ID, withCuratorAnswer(map, a, answerSettings(a)))
    answerCuratorOffer(a, { stashSaves: true })
  }
  return (
    <Setting
      id={`plugin-${PLUGIN_ID}-curator-offer`}
      className="cherrypick-ui cherrypick-curator-offer"
      heading={OFFER.title}
      subHeading={OFFER.sub}
    >
      <Button
        variant="secondary"
        size="sm"
        className="cherrypick-curator-hide"
        onClick={() => answer('hide')}
      >
        {OFFER.hide}
      </Button>{' '}
      <Button
        variant="secondary"
        size="sm"
        className="cherrypick-curator-keep"
        onClick={() => answer('keep')}
      >
        {OFFER.keep}
      </Button>
    </Setting>
  )
}

// Reasons on cards: Stash's plugin settings are only BOOLEAN, STRING or
// NUMBER, and a STRING is a text box, so the row is drawn here as Stash's
// SelectSetting draws one (which takes no plain heading), with the
// manifest's name and description, and saves as the switches do.
const REASON_SETTING = 'reasonDisplay'
const REASON_CHOICES = { text: 'Text', icon: 'Icon', off: 'Off' }

function ReasonDisplay({ setting }) {
  const { plugins, savePluginSettings } = hooks.useSettings()
  const map = plugins?.[PLUGIN_ID] || {}
  const { Setting } = components
  const change = (value) => {
    savePluginSettings(PLUGIN_ID, { ...map, [REASON_SETTING]: value })
    store.set((s) => ({ settings: { ...s.settings, [REASON_SETTING]: value } }))
  }
  return (
    <Setting
      id={`plugin-${PLUGIN_ID}-${REASON_SETTING}`}
      className="cherrypick-ui"
      heading={setting.display_name || setting.name}
      subHeading={setting.description || undefined}
    >
      <Form.Control
        as="select"
        className="input-control"
        value={reasonDisplayOf(map[REASON_SETTING])}
        onChange={(e) => change(e.currentTarget.value)}
      >
        {Object.entries(REASON_CHOICES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Form.Control>
    </Setting>
  )
}

// The drop-down in the switch's place: before the first switch the
// manifest lists after it.
function withReasonRow(children, row) {
  const rank = (name) => SETTING_KEYS.indexOf(name)
  const at = children.findIndex(
    (c) => rank(c.props?.setting?.name) > rank(REASON_SETTING),
  )
  return at < 0
    ? [...children, row]
    : [...children.slice(0, at), row, ...children.slice(at)]
}

function PageLink() {
  const { Setting } = components
  const { Link } = ReactRouterDOM
  return (
    <Setting
      id={`plugin-${PLUGIN_ID}-page`}
      className="cherrypick-ui"
      heading={`${PLUGIN_NAME} page`}
      subHeading={`For you in full, the Hall of Fame, how well Your score is doing, StashDB, what you hid, and Remove ${PLUGIN_NAME} data.`}
    >
      <Link className="btn btn-secondary btn-sm" to={PLUGIN_ROUTE}>
        Open
      </Link>
    </Setting>
  )
}

export function registerSettingsExtras() {
  // Sorted, and without Reasons on cards, which the after patch draws as a
  // drop-down from the setting it is handed here
  patch.before('PluginSettings', (props, ...rest) => {
    if (props?.pluginID !== PLUGIN_ID || !Array.isArray(props.settings))
      return [props, ...rest]
    const reasons = props.settings.find((x) => x.name === REASON_SETTING)
    return [
      {
        ...props,
        settings: inManifestOrder(props.settings.filter((x) => x !== reasons)),
        cherrypickReasons: reasons,
      },
      ...rest,
    ]
  })
  patchAfter('PluginSettings', (props, result) => {
    if (props.pluginID !== PLUGIN_ID) return result
    const reasons = props.cherrypickReasons ? (
      <Safe key="cherrypick-reasons" name="reasons on cards">
        <ReasonDisplay setting={props.cherrypickReasons} />
      </Safe>
    ) : null
    const rows = (
      <Safe key="cherrypick-settings-extras" name="settings extras">
        {/* On its own: it reads Stash's Settings page through PluginApi.hooks */}
        <Safe name="Curator offer">
          <CuratorOffer />
        </Safe>
        <BracketGender />
        <PageLink />
      </Safe>
    )
    // Inside Stash's .plugin-settings, after the last switch, so its
    // dividers run on; beside it if another plugin changed what it renders.
    if (React.isValidElement(result) && result.type === 'div') {
      const switches = React.Children.toArray(result.props.children)
      return React.cloneElement(
        result,
        undefined,
        ...(reasons ? withReasonRow(switches, reasons) : switches),
        rows,
      )
    }
    return (
      <>
        {result}
        <div className="plugin-settings">
          {reasons}
          {rows}
        </div>
      </>
    )
  })
}
