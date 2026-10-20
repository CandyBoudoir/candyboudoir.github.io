// City Pop in Stash UI, another author's replacement interface for Stash
// (github.com/anonym88312/stash-pmv-plugins). Stash UI draws its own pages and
// loads no plugin's ui.css or ui.javascript. Its extension API imports
// assets/stashui.js from every enabled plugin and calls the default export, so
// this module runs only while both plugins are on.
//
// City Pop joins the presets under Stash UI's Settings > This interface >
// Colors. Picking it stores City Pop's palette in Stash UI's own colour setting,
// which Stash UI paints before it draws anything, so from the next load on the
// dusk shows from the first frame. stashui.css adds what Stash UI's ten colours
// leave out and, with the Stash UI fonts setting on, City Pop's type.

const PLUGIN_ID = 'Theme-CityPop'
const PRESET = `${PLUGIN_ID}:citypop`
const NAME = 'City Pop'

// The dusk in Stash UI's ten colour slots (01-tokens.css)
const COLORS = {
  '--pink': '#ff7a6b', // the accent: the sun
  '--bg': '#0c0e30', // night
  '--bg-2': '#1a1848', // panel
  '--bg-3': '#3a3678', // line
  '--base': '#0e0f33', // well: the menu, fields and lists
  '--text': '#fff4ec',
  '--text-2': '#cbc3ec', // muted
  '--faint': '#a39bd3', // dim
  '--ok': '#6ff0e6', // pool water
  '--danger': '#ff7d92',
}

// Stash UI keeps its colour setting in localStorage under "stashui.theme"
const THEME_KEY = 'stashui.theme'
// The Stash UI fonts setting, kept from the last visit so the type does not
// wait for the settings request
const FONTS_KEY = 'citypop.stashui.fonts'

const root = document.documentElement

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A browser without storage keeps the choice for this page only.
  }
}

const picked = () => read(THEME_KEY)?.preset === PRESET
let fonts = read(FONTS_KEY) === true

// City Pop's classes on <html>: one while it is the picked preset (its colours
// may have been changed with the wheel since), one for its type
function sync() {
  const on = picked()
  root.classList.toggle('citypop-stashui', on)
  root.classList.toggle('citypop-stashui-fonts', on && fonts)
}

// Stash UI paints the stored colours itself on its next load. Until then this
// sets them the way its applyTheme does: the ten colours plus the shades it
// works out from them.
function paint(c) {
  const style = root.style
  for (const [name, value] of Object.entries(c)) style.setProperty(name, value)
  style.setProperty('--pink-2', `color-mix(in srgb, ${c['--pink']}, #fff 25%)`)
  style.setProperty(
    '--pink-deep',
    `color-mix(in srgb, ${c['--pink']}, #000 55%)`,
  )
  style.setProperty('--fav', c['--pink'])
  style.setProperty(
    '--line',
    `color-mix(in srgb, ${c['--bg-3']} 85%, ${c['--bg']})`,
  )
  style.setProperty('--ink', c['--bg'])
  style.setProperty('--paper', c['--text'])
  style.setProperty(
    '--tone',
    `radial-gradient(circle, color-mix(in srgb, ${c['--pink']} 22%, transparent) 1.1px, transparent 1.7px)`,
  )
}

function pick(box) {
  write(THEME_KEY, { preset: PRESET, colors: { ...COLORS } })
  paint(COLORS)
  for (const button of box.querySelectorAll('[data-preset]'))
    button.classList.toggle('is-on', button.dataset.preset === PRESET)
  // The colour list under the presets shows the stored colours
  for (const token of box.querySelectorAll('[data-token]')) {
    const value = COLORS[token.dataset.token]
    if (!value) continue
    const swatch = token.querySelector('i')
    const code = token.querySelector('code')
    if (swatch) swatch.style.background = value
    if (code) code.textContent = value
  }
  sync()
}

// The preset button, in Stash UI's own markup. Stash UI ignores a click on a
// preset it does not know, so this button handles its own.
function presetButton(box) {
  const theme = read(THEME_KEY)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'kb-theme-preset citypop-preset'
  if (theme?.preset === PRESET && !theme.custom) button.classList.add('is-on')
  button.dataset.preset = PRESET
  button.style.setProperty('--p-bg', COLORS['--bg'])
  button.style.setProperty('--p-2', COLORS['--bg-2'])
  button.style.setProperty('--p-acc', COLORS['--pink'])
  button.style.setProperty('--p-text', COLORS['--text'])
  button.append(document.createElement('i'))
  const label = document.createElement('span')
  label.textContent = NAME
  button.append(label)
  button.addEventListener('click', () => pick(box))
  return button
}

// Stash UI redraws the colour settings whenever a preset changes, so the button
// goes back in after the built-in presets each time they appear.
function addButton() {
  for (const presets of document.querySelectorAll('.kb-theme-presets')) {
    if (presets.querySelector('.citypop-preset')) continue
    const box = presets.closest('[data-theme]') ?? presets
    const builtIn = [
      ...presets.querySelectorAll('[data-preset]:not([data-preset^="own:"])'),
    ].pop()
    const button = presetButton(box)
    if (builtIn) builtIn.after(button)
    else presets.prepend(button)
  }
}

async function loadFonts(stashui) {
  try {
    const data = await stashui.gql(
      `query { configuration { plugins(include: ["${PLUGIN_ID}"]) } }`,
    )
    fonts = data?.configuration?.plugins?.[PLUGIN_ID]?.stashUIFonts === true
    write(FONTS_KEY, fonts)
    sync()
  } catch {
    // Keep the setting from the last visit.
  }
}

export default function setup(stashui) {
  const sheet = document.createElement('link')
  sheet.rel = 'stylesheet'
  sheet.href = new URL(
    `stashui.css${new URL(import.meta.url).search}`,
    import.meta.url,
  ).href
  document.head.append(sheet)

  sync()
  addButton()

  let queued = false
  new MutationObserver(() => {
    if (queued) return
    queued = true
    window.requestAnimationFrame(() => {
      queued = false
      addButton()
    })
  }).observe(document.body, { childList: true, subtree: true })

  // Another preset, a colour from the wheel or Back to default colors changes
  // Stash UI's setting during the click, before it reaches the document.
  document.addEventListener('click', sync)
  window.addEventListener('storage', sync)

  // The fonts setting is read again on every page Stash UI opens, so a change
  // takes effect on the next page, with no reload
  loadFonts(stashui)
  if (stashui.has?.('on')) stashui.on('route', () => loadFonts(stashui))
}
