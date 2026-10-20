// Styles for Stash UI. Stash UI, another author's replacement interface for
// Stash (github.com/anonym88312/stash-pmv-plugins), draws its own pages and
// loads no plugin's ui.css or ui.javascript. Its extension API imports
// assets/stashui.js from every enabled plugin and calls the default export.
//
// Each style joins the presets under Stash UI's Settings > Appearance >
// Colors. Picking one stores its colours in Stash UI's own colour setting,
// which Stash UI paints before it draws anything, so from the next load on the
// colours show from the first frame. stashui.css adds what Stash UI's ten
// colours leave out and, unless Colors only is on, the style's type and
// backdrop.

const PLUGIN_ID = 'StylesForStashUI'

// Each style's colours in Stash UI's ten colour slots, from the theme's own
// tokens (plugins/<theme>/src/css/01-tokens.css)
const STYLES = [
  {
    id: 'citypop',
    name: 'City Pop',
    colors: {
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
    },
  },
  {
    id: 'overclock',
    name: 'Overclock',
    colors: {
      '--pink': '#f3e600', // the accent: acid yellow
      '--bg': '#0a0a0c',
      '--bg-2': '#0d1416', // panel
      '--bg-3': '#24363b', // rule
      '--base': '#070b0c', // field: the menu, fields and lists
      '--text': '#e8efee',
      '--text-2': '#a8bab9', // muted
      '--faint': '#86999a', // dim
      '--ok': '#00e5ff', // cyan, Overclock's match colour
      '--danger': '#ff1f4b',
    },
  },
]

const presetId = (style) => `${PLUGIN_ID}:${style.id}`

// Stash UI keeps its colour setting in localStorage under "stashui.theme"
const THEME_KEY = 'stashui.theme'
// The Colors only setting, kept from the last visit so the type does not wait
// for the settings request
const COLORS_ONLY_KEY = 'stylesforstashui.colorsOnly'

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

// The style picked in Stash UI's colour setting, whose colours may have been
// changed with the wheel since
const picked = () => {
  const preset = read(THEME_KEY)?.preset
  return STYLES.find((style) => presetId(style) === preset) ?? null
}

let colorsOnly = read(COLORS_ONLY_KEY) === true

// The attributes stashui.css waits for on <html>: data-sfs-style names the
// picked style, data-sfs-type is there while its type is on
function sync() {
  const style = picked()
  if (style) root.dataset.sfsStyle = style.id
  else delete root.dataset.sfsStyle
  root.toggleAttribute('data-sfs-type', Boolean(style) && !colorsOnly)
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

function pick(style, box) {
  write(THEME_KEY, { preset: presetId(style), colors: { ...style.colors } })
  paint(style.colors)
  for (const button of box.querySelectorAll('[data-preset]'))
    button.classList.toggle('is-on', button.dataset.preset === presetId(style))
  // The colour list under the presets shows the stored colours
  for (const token of box.querySelectorAll('[data-token]')) {
    const value = style.colors[token.dataset.token]
    if (!value) continue
    const swatch = token.querySelector('i')
    const code = token.querySelector('code')
    if (swatch) swatch.style.background = value
    if (code) code.textContent = value
  }
  sync()
  addControls()
}

// A style's button, in Stash UI's own markup. Stash UI ignores a click on a
// preset it does not know, so the button handles its own.
function styleButton(style, box) {
  const theme = read(THEME_KEY)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'kb-theme-preset sfs-style'
  if (theme?.preset === presetId(style) && !theme.custom)
    button.classList.add('is-on')
  button.dataset.preset = presetId(style)
  button.style.setProperty('--p-bg', style.colors['--bg'])
  button.style.setProperty('--p-2', style.colors['--bg-2'])
  button.style.setProperty('--p-acc', style.colors['--pink'])
  button.style.setProperty('--p-text', style.colors['--text'])
  button.append(document.createElement('i'))
  const label = document.createElement('span')
  label.textContent = style.name
  button.append(label)
  button.addEventListener('click', () => pick(style, box))
  return button
}

let gql = null

// Colors only lives in the plugin's settings in Stash, so the switch here and
// the one under Settings > Plugins are the same setting. Stash replaces a
// plugin's whole configuration, so the switch keeps whatever else is there.
async function saveColorsOnly(on) {
  colorsOnly = on
  write(COLORS_ONLY_KEY, on)
  sync()
  if (!gql) return
  try {
    const data = await gql(
      `query { configuration { plugins(include: ["${PLUGIN_ID}"]) } }`,
    )
    const config = data?.configuration?.plugins?.[PLUGIN_ID] ?? {}
    await gql(
      'mutation ($input: Map!) { configurePlugin(plugin_id: "' +
        PLUGIN_ID +
        '", input: $input) }',
      { input: { ...config, colorsOnly: on } },
    )
  } catch {
    // Stash keeps the old setting; this browser keeps the new one until the
    // next page reads it again.
  }
}

const colorsOnlyHint = (style) =>
  `Only ${style.name}'s colors: Stash UI keeps its own fonts, lettering and backdrop.`

// The Colors only switch, in the row Stash UI's Liquid glass switch uses
function colorsOnlySwitch(style) {
  const row = document.createElement('label')
  row.className = 'kb-theme-glass sfs-colors-only'
  const toggle = document.createElement('span')
  toggle.className = 'kb-switch'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = colorsOnly
  input.addEventListener('change', () => saveColorsOnly(input.checked))
  toggle.append(input, document.createElement('i'))
  const text = document.createElement('span')
  const title = document.createElement('b')
  title.textContent = 'Colors only'
  const hint = document.createElement('small')
  hint.textContent = colorsOnlyHint(style)
  text.append(title, hint)
  row.append(toggle, text)
  return row
}

// Stash UI redraws the colour settings whenever a preset changes, so the
// buttons go back in after its own presets each time they appear, and the
// switch under them while a style is picked.
function addControls() {
  const style = picked()
  for (const presets of document.querySelectorAll('.kb-theme-presets')) {
    const box = presets.closest('[data-theme]') ?? presets
    if (!presets.querySelector('.sfs-style')) {
      let after = [
        ...presets.querySelectorAll('[data-preset]:not([data-preset^="own:"])'),
      ].pop()
      for (const each of STYLES) {
        const button = styleButton(each, box)
        if (after) after.after(button)
        else presets.prepend(button)
        after = button
      }
    }
    const row = box.querySelector('.sfs-colors-only')
    if (!style) row?.remove()
    else if (!row) presets.after(colorsOnlySwitch(style))
    else row.querySelector('small').textContent = colorsOnlyHint(style)
  }
}

async function loadColorsOnly() {
  try {
    const data = await gql(
      `query { configuration { plugins(include: ["${PLUGIN_ID}"]) } }`,
    )
    colorsOnly = data?.configuration?.plugins?.[PLUGIN_ID]?.colorsOnly === true
    write(COLORS_ONLY_KEY, colorsOnly)
    sync()
    for (const input of document.querySelectorAll('.sfs-colors-only input'))
      input.checked = colorsOnly
  } catch {
    // Keep the setting from the last visit.
  }
}

export default function setup(stashui) {
  gql = stashui.gql
  const sheet = document.createElement('link')
  sheet.rel = 'stylesheet'
  sheet.href = new URL(
    `stashui.css${new URL(import.meta.url).search}`,
    import.meta.url,
  ).href
  document.head.append(sheet)

  sync()
  addControls()

  let queued = false
  new MutationObserver(() => {
    if (queued) return
    queued = true
    window.requestAnimationFrame(() => {
      queued = false
      addControls()
    })
  }).observe(document.body, { childList: true, subtree: true })

  // Another preset, a colour from the wheel or Back to default colors changes
  // Stash UI's setting during the click, before it reaches the document.
  document.addEventListener('click', () => {
    sync()
    addControls()
  })
  window.addEventListener('storage', sync)

  // Colors only is read again on every page Stash UI opens, so a change made
  // under Settings > Plugins takes effect on the next page, with no reload
  loadColorsOnly()
  if (stashui.has?.('on')) stashui.on('route', loadColorsOnly)
}
