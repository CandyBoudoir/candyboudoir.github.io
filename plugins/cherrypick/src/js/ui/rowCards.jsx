// Stash's SceneCard, as Cherry Pick's rows and For you's tab show it: the
// card's description gives way to the reason the card is there, and its
// popover row gains the ⋯ menu (Refract's row of pills, under Refract). The
// patches apply to every SceneCard, so they read a context only Cherry
// Pick's rows and tab provide and render nothing anywhere else.
import { components, patchAfter, React, ReactDOM } from '../runtime/api.js'
import { CardMenu } from './CardMenu.jsx'
import { refract } from './refract.js'
import { Safe } from './Safe.jsx'

export const RowItem = React.createContext(null)
// For you's tab: its cards come from Stash's SceneList, one context for all
// of them. { rowId, items: Map(scene id -> item) }
export const PageItems = React.createContext(null)

// The row item a card stands for, with its row, or null on Stash's own cards
function useItem(scene) {
  const row = React.useContext(RowItem)
  const page = React.useContext(PageItems)
  if (row) return row
  const item = scene && page?.items.get(scene.id)
  return item ? { item, rowId: page.rowId } : null
}

function Reason({ scene }) {
  const ctx = useItem(scene)
  if (!ctx?.item.reason) return null
  return (
    <div className="scene-card__description cherrypick-reason cherrypick-ui">
      {ctx.item.reason}
    </div>
  )
}

function Menu({ scene }) {
  const ctx = useItem(scene)
  if (!ctx || !ctx.item.scene) return null
  return refract() ? (
    <PillMenu item={ctx.item} rowId={ctx.rowId} />
  ) : (
    <CardMenu item={ctx.item} rowId={ctx.rowId} />
  )
}

// Refract hides the popover row and draws a row of pills over the picture
// once it has the scene's counts. The menu goes at the end of those pills,
// through a portal, and back there if Refract draws them again.
function PillMenu({ item, rowId }) {
  const anchor = React.useRef(null)
  const [slot, setSlot] = React.useState(null)
  React.useEffect(() => {
    const card = anchor.current?.closest('.scene-card')
    if (!card) return
    const el = document.createElement('div')
    el.className = 'cherrypick-pill-menu'
    const place = () => {
      const pills = card.querySelector('.stash-card-counts')
      if (pills && el.parentNode !== pills) pills.appendChild(el)
    }
    place()
    setSlot(el)
    const watch = new MutationObserver(place)
    watch.observe(card, { childList: true, subtree: true })
    return () => {
      watch.disconnect()
      el.remove()
    }
  }, [])
  return (
    <>
      <span ref={anchor} hidden />
      {slot
        ? ReactDOM.createPortal(<CardMenu item={item} rowId={rowId} />, slot)
        : null}
    </>
  )
}

// A card with no tags, performers or counts has no popover row, so in
// Cherry Pick's rows the menu brings its own, in Stash's markup.
function MenuRow({ scene }) {
  const ctx = useItem(scene)
  if (!ctx || !ctx.item.scene) return null
  return (
    <>
      <hr />
      <div className="card-popovers btn-group">
        <Menu scene={scene} />
      </div>
    </>
  )
}

// The ButtonGroup Stash renders as .card-popovers, a few fragments down,
// with the menu added.
function withMenu(node, menu, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4) return null
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const found = withMenu(node[i], menu, depth + 1)
      if (found) return node.map((n, j) => (j === i ? found : n))
    }
    return null
  }
  const props = node.props || {}
  if (String(props.className || '').includes('card-popovers'))
    return React.cloneElement(
      node,
      {},
      ...[].concat(props.children ?? []),
      menu,
    )
  if (props.children == null) return null
  const inner = withMenu(props.children, menu, depth + 1)
  if (!inner) return null
  // Spread an array back out, as JSX passed it, so React wants no keys.
  return Array.isArray(inner)
    ? React.cloneElement(node, {}, ...inner)
    : React.cloneElement(node, {}, inner)
}

export function registerRowCards() {
  patchAfter('SceneCard.Details', (props, result) => (
    <>
      {result}
      <Safe name="row reason">
        <Reason scene={props.scene} />
      </Safe>
    </>
  ))
  patchAfter(
    'SceneCard.Popovers',
    (props, result) =>
      withMenu(result, <Menu key="cherrypick-menu" scene={props.scene} />) || (
        <>
          {result}
          <Safe name="card menu">
            <MenuRow scene={props.scene} />
          </Safe>
        </>
      ),
  )
}

// One scene card in a Cherry Pick row. onOpen fires when the card is
// clicked through (For you's "opened" signal).
export function RowSceneCard({ scene, item, rowId, index, onOpen }) {
  const { SceneCard } = components
  if (!SceneCard) return null
  return (
    <RowItem.Provider value={{ item, rowId }}>
      <div
        className="cherrypick-card"
        onClickCapture={(e) => {
          if (onOpen && e.target.closest('a[href]')) onOpen(item.scene.id)
        }}
      >
        <SceneCard scene={scene} index={index} zoomIndex={1} />
      </div>
    </RowItem.Provider>
  )
}
