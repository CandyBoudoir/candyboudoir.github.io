// Watch This: with the setting on, Cherry Pick's front-page rows give way to
// one scene in Stash's own ScenePlayer at the content area's full width, with
// one line under it (title, performers, the reason). Stash's rows and its
// Customise button stay below. The pick is model/watch.js's.
//
// Stash's player does everything it does on the scene page: it records the
// play, the play duration and the resume time (subject to Stash's activity
// tracking), starts by itself when Stash's Auto-start video setting is on,
// starts at the resume time unless Always start from beginning is on, and
// takes keyboard focus when a scene loads. When the scene ends nothing
// happens. Watch This adds no tracking of its own and writes nothing to For
// you's opens or passes.
//
// Once the player plays, the line steps out until the user leaves the front
// page and the player stays (runtime/watching.js): nothing else of Cherry
// Pick's appears during or after playback.
import {
  components,
  GQL,
  hooks,
  React,
  ReactRouterDOM,
} from '../runtime/api.js'
import { context, visitSignals } from '../model/foryou.js'
import { watchOrder } from '../model/watch.js'
import { BuildingLine } from '../ui/BuildingLine.jsx'
import { useAppState } from '../ui/hooks.js'

const { useLayoutEffect, useMemo, useRef, useState } = React
const { Link } = ReactRouterDOM
const { loadableComponents } = window.PluginApi
const PLAYER = [loadableComponents.ScenePlayer]

// The player's callbacks Watch This leaves to Stash: nothing when the scene
// ends, and no timestamp to set from outside. One function, so the player's
// effects that depend on them never run again.
const ignore = () => {}

// ------------------------------------------------------------ the visit's pick

let snap = null

// Every scene Watch This could play this visit, best first: worked out when
// the front page opens with a model, and held for the visit, so the pick
// never changes on screen. It reads For you's signals for the visit and
// stores nothing back.
function snapshot(s) {
  if (!s.M) return null
  const key = [s.visit, JSON.stringify(s.settings)].join('|')
  if (snap?.key === key) return snap
  const skip = new Set(s.dontLearn.map((d) => d.sceneId))
  const order = watchOrder(context(s.M, s), visitSignals(s.signals, skip))
  snap = { key, order }
  return snap
}

// ------------------------------------------------------------ pieces

// Watch This's box. The player's height is capped at the window's height
// less what sits above it and the line under it (css/22-watch.css), both
// measured here, since a theme can change the navbar's height and the
// line's font. Measured again when the window resizes and once the fonts
// load. The line's last height is kept while it steps out, so the player
// never grows during playback.
function Box({ children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    let live = true
    const fit = () => {
      if (!live) return
      const above = el.getBoundingClientRect().top + window.scrollY
      el.style.setProperty('--cherrypick-watch-above', `${Math.ceil(above)}px`)
      const line = el.querySelector('.cherrypick-watch-line')
      if (line)
        el.style.setProperty(
          '--cherrypick-watch-line',
          `${Math.ceil(line.getBoundingClientRect().height)}px`,
        )
    }
    fit()
    window.addEventListener('resize', fit)
    document.fonts?.ready.then(fit)
    return () => {
      live = false
      window.removeEventListener('resize', fit)
    }
  })
  return (
    <div className="cherrypick-watch" ref={ref}>
      {children}
    </div>
  )
}

// The player's place while the library, the model or the scene loads: a
// 16:9 box of Stash's skeleton, with For you's progress line under it.
function Skeleton() {
  return (
    <Box>
      <div className="skeleton-card cherrypick-watch-skeleton" />
      <div className="cherrypick-watch-line cherrypick-ui">
        <BuildingLine />
      </div>
    </Box>
  )
}

const basename = (path) => String(path || '').replace(/^.*[\\/]/, '')

// The line under the player: the scene's title, linking to its page, its
// performers and why Cherry Pick picked it.
function Line({ scene, reason }) {
  const title = scene.title || basename(scene.files?.[0]?.path)
  return (
    <div className="cherrypick-watch-line cherrypick-ui">
      <span className="cherrypick-watch-what">
        <Link className="cherrypick-watch-title" to={`/scenes/${scene.id}`}>
          {title}
        </Link>
        {scene.performers.length ? (
          <span className="cherrypick-watch-performers">
            {scene.performers.map((p, i) => (
              <React.Fragment key={p.id}>
                {i ? ', ' : null}
                <Link to={`/performers/${p.id}`}>{p.name}</Link>
              </React.Fragment>
            ))}
          </span>
        ) : null}
        {reason ? (
          <span className="cherrypick-watch-reason text-muted">{reason}</span>
        ) : null}
      </span>
    </div>
  )
}

function Pick({ item, watching }) {
  const loading = hooks.useLoadComponents(PLAYER)
  // Stash's own query for the scene page's record, the SceneDataFragment
  // the player takes. Its last answer stays up while the next one loads.
  const { data, previousData } = GQL.useFindSceneQuery({
    variables: { id: item.scene.id },
  })
  const scene = data?.findScene ?? previousData?.findScene
  // Stash's Show scrubber setting, read once as the scene page does
  const { data: config } = GQL.useConfigurationQuery()
  const [hideScrubber] = useState(
    () => !(config?.configuration?.interface?.showScrubber ?? true),
  )
  const reason = useMemo(() => item.reason(), [item])
  const { ScenePlayer } = components
  if (loading || !scene || !ScenePlayer) return <Skeleton />
  return (
    <Box>
      <div className="cherrypick-watch-player">
        <ScenePlayer
          scene={scene}
          hideScrubberOverride={hideScrubber}
          initialTimestamp={0}
          sendSetTimestamp={ignore}
          onComplete={ignore}
        />
      </div>
      {watching ? null : <Line scene={scene} reason={reason} />}
    </Box>
  )
}

export function WatchThis() {
  const s = useAppState((x) => x)
  const v = snapshot(s)
  if (!v) return <Skeleton />
  // A library with no scene that has video: Stash's rows alone
  const item = v.order[0]
  if (!item) return null
  return <Pick item={item} watching={s.watching} />
}
