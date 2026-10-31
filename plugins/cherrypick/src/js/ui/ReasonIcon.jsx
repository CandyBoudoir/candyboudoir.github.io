// For you's reason as an icon at the bottom left of a card's cover, under
// Reasons on cards: Icon. One icon per reason, picked with it in
// model/foryou.js. Pointing at it (or focusing it from the keyboard) shows
// the whole reason; on a phone a tap does, and a tap anywhere else closes
// it. The icon sits beside the card's link, not in it, so a tap opens
// nothing and counts as no click through, and while it is pointed at or
// pressed the card's preview stays hidden (css/20-rows.css).
import {
  Bootstrap,
  FontAwesomeSolid,
  React,
  components,
} from '../runtime/api.js'
import { Cherries } from './Cherries.jsx'

const { Overlay, Popover, PopoverContent } = Bootstrap
const { faArrowTrendUp, faClockRotateLeft, faFlask, faSeedling } =
  FontAwesomeSolid

const GLYPHS = {
  trend: faArrowTrendUp,
  seedling: faSeedling,
  clock: faClockRotateLeft,
  flask: faFlask,
}

// Stash's own hover popovers wait as long before they open (HoverPopover)
const HOVER_MS = 200

function Glyph({ icon }) {
  const { Icon } = components
  if (icon === 'cherries') return <Cherries />
  const fa = GLYPHS[icon]
  return fa && Icon ? <Icon icon={fa} /> : null
}

export function ReasonIcon({ sceneId, icon, text }) {
  const button = React.useRef(null)
  const id = `cherrypick-reason-${sceneId}`
  const timer = React.useRef(0)
  // the pointer that pressed the icon last: a mouse's click keeps the
  // reason its hover opened, a tap toggles it
  const pointer = React.useRef('')
  const [show, setShow] = React.useState(false)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  // A tap or press anywhere else, or Escape, closes it
  React.useEffect(() => {
    if (!show) return
    const away = (e) => {
      if (
        !button.current?.contains(e.target) &&
        !document.getElementById(id)?.contains(e.target)
      )
        setShow(false)
    }
    const esc = (e) => e.key === 'Escape' && setShow(false)
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', esc)
    }
  }, [show, id])

  const later = (on) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(on), HOVER_MS)
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className="cherrypick-reason-icon cherrypick-ui"
        data-icon={icon}
        aria-label={text}
        aria-expanded={show}
        onPointerEnter={(e) => e.pointerType === 'mouse' && later(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && later(false)}
        onPointerDown={(e) => {
          pointer.current = e.pointerType
        }}
        onFocus={(e) => e.target.matches(':focus-visible') && setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          window.clearTimeout(timer.current)
          const mouse = pointer.current === 'mouse'
          pointer.current = ''
          setShow((on) => mouse || !on)
        }}
      >
        <span className="cherrypick-reason-glyph">
          <Glyph icon={icon} />
        </span>
      </button>
      <Overlay target={button} show={show} placement="top">
        <Popover id={id} className="cherrypick-reason-popover cherrypick-ui">
          <PopoverContent>{text}</PopoverContent>
        </Popover>
      </Overlay>
    </>
  )
}
