// A CandyBoudoir theme as a style in Stash UI, another author's replacement
// interface for Stash (github.com/anonym88312/stash-pmv-plugins). Stash UI
// draws its own pages and loads no plugin's ui.css or ui.javascript; its
// extension API imports assets/stashui.js from every enabled plugin and calls
// the default export. Each "<Theme> for Stash UI" plugin bundles this module
// with its own style into that file (see plugins/citypop-stashui/plugin.mjs).
//
// The style joins the presets under Stash UI's Settings > Appearance > Colors.
// Picking it stores its colours in Stash UI's own colour setting, which Stash
// UI paints before it draws anything, so from the next load on the colours
// show from the first frame. The plugin's stashui.css adds what Stash UI's ten
// colours leave out and, unless the plugin's Colors only setting is on, the
// theme's type and backdrop. Several of these plugins run side by side: each
// adds its own button and switch, and touches the page only while its own
// style is picked.

// Stash UI keeps its colour setting in localStorage under "stashui.theme"
const THEME_KEY = 'stashui.theme'

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

// The Stash UI module for one style: { pluginId, id, name, colors }, where
// colors fills Stash UI's ten colour slots from the theme's own tokens
export function stashUIStyle(style) {
  const preset = `${style.pluginId}:${style.id}`
  // The Colors only setting, kept from the last visit so the type does not
  // wait for the settings request
  const colorsOnlyKey = `${style.pluginId}.colorsOnly`
  let colorsOnly = read(colorsOnlyKey) === true
  let gql = null

  // Picked in Stash UI's colour setting, whose colours may have been changed
  // with the wheel since
  const picked = () => read(THEME_KEY)?.preset === preset

  // The attributes stashui.css waits for on <html>: data-cb-style names the
  // picked style, data-cb-type is there while its type is on. Another style's
  // plugin owns them while its style is picked.
  function sync() {
    if (picked()) {
      root.dataset.cbStyle = style.id
      root.toggleAttribute('data-cb-type', !colorsOnly)
    } else if (root.dataset.cbStyle === style.id) {
      delete root.dataset.cbStyle
      root.removeAttribute('data-cb-type')
    }
  }

  function pick(box) {
    write(THEME_KEY, { preset, colors: { ...style.colors } })
    paint(style.colors)
    for (const button of box.querySelectorAll('[data-preset]'))
      button.classList.toggle('is-on', button.dataset.preset === preset)
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

  // The style's button, in Stash UI's own markup. Stash UI ignores a click on
  // a preset it does not know, so the button handles its own.
  function styleButton(box) {
    const theme = read(THEME_KEY)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'kb-theme-preset cb-style'
    if (theme?.preset === preset && !theme.custom) button.classList.add('is-on')
    button.dataset.preset = preset
    button.style.setProperty('--p-bg', style.colors['--bg'])
    button.style.setProperty('--p-2', style.colors['--bg-2'])
    button.style.setProperty('--p-acc', style.colors['--pink'])
    button.style.setProperty('--p-text', style.colors['--text'])
    button.append(document.createElement('i'))
    const label = document.createElement('span')
    label.textContent = style.name
    button.append(label)
    button.addEventListener('click', () => pick(box))
    return button
  }

  // Colors only lives in the plugin's settings in Stash, so the switch under
  // the presets and the one under Settings > Plugins are the same setting.
  // Stash replaces a plugin's whole configuration, so the switch keeps
  // whatever else is there.
  async function saveColorsOnly(on) {
    colorsOnly = on
    write(colorsOnlyKey, on)
    sync()
    if (!gql) return
    try {
      const data = await gql(
        `query { configuration { plugins(include: ["${style.pluginId}"]) } }`,
      )
      const config = data?.configuration?.plugins?.[style.pluginId] ?? {}
      await gql(
        'mutation ($input: Map!) { configurePlugin(plugin_id: "' +
          style.pluginId +
          '", input: $input) }',
        { input: { ...config, colorsOnly: on } },
      )
    } catch {
      // Stash keeps the old setting; this browser keeps the new one until the
      // next page reads it again.
    }
  }

  // The Colors only switch, in the row Stash UI's Liquid glass switch uses
  function colorsOnlySwitch() {
    const row = document.createElement('label')
    row.className = 'kb-theme-glass cb-colors-only'
    row.dataset.plugin = style.pluginId
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
    hint.textContent = `Only ${style.name}'s colors: Stash UI keeps its own fonts, lettering and backdrop.`
    text.append(title, hint)
    row.append(toggle, text)
    return row
  }

  // Stash UI redraws the colour settings whenever a preset changes, so the
  // button goes back in after the presets each time they appear (its own and
  // other plugins' styles), and the switch under them while the style is
  // picked.
  function addControls() {
    const on = picked()
    for (const presets of document.querySelectorAll('.kb-theme-presets')) {
      const box = presets.closest('[data-theme]') ?? presets
      if (!presets.querySelector(`[data-preset="${preset}"]`)) {
        const after = [
          ...presets.querySelectorAll(
            '[data-preset]:not([data-preset^="own:"])',
          ),
        ].pop()
        const button = styleButton(box)
        if (after) after.after(button)
        else presets.prepend(button)
      }
      const row = box.querySelector(
        `.cb-colors-only[data-plugin="${style.pluginId}"]`,
      )
      if (!on) row?.remove()
      else if (!row) presets.after(colorsOnlySwitch())
    }
  }

  async function loadColorsOnly() {
    try {
      const data = await gql(
        `query { configuration { plugins(include: ["${style.pluginId}"]) } }`,
      )
      colorsOnly =
        data?.configuration?.plugins?.[style.pluginId]?.colorsOnly === true
      write(colorsOnlyKey, colorsOnly)
      sync()
      for (const input of document.querySelectorAll(
        `.cb-colors-only[data-plugin="${style.pluginId}"] input`,
      ))
        input.checked = colorsOnly
    } catch {
      // Keep the setting from the last visit.
    }
  }

  return function setup(stashui) {
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

    // Another preset, another plugin's style, a colour from the wheel or Back
    // to default colors changes Stash UI's setting during the click, before
    // it reaches the document
    document.addEventListener('click', () => {
      sync()
      addControls()
    })
    window.addEventListener('storage', sync)

    // Colors only is read again on every page Stash UI opens, so a change
    // made under Settings > Plugins takes effect on the next page, with no
    // reload
    loadColorsOnly()
    if (stashui.has?.('on')) stashui.on('route', loadColorsOnly)
  }
}
