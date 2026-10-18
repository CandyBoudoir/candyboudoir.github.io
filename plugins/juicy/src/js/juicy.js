// Juicy's JavaScript extras: heart bursts on rating, cheeky copy and the calm
// switch. Everything here is optional decoration: the theme is complete in CSS,
// and this file degrades to nothing when PluginApi or GraphQL are missing (as
// on the design-system page).
;(function () {
  'use strict'

  const PLUGIN_ID = 'Theme-Juicy'
  const root = document.documentElement

  // Stash's own wording mapped to Juicy's. Exact, whole-text matches only, so
  // user content (titles, tags, descriptions) is never touched.
  const CHEEKY_COPY = new Map([
    ['Loading…', 'Getting juicy…'],
    ['Loading plugins…', 'Warming up the toys…'],
    ['No results found.', 'Nothing juicy here. Yet.'],
    ['No tasks are currently running.', 'All quiet. Too quiet.'],
    ['Performer Favourited', 'New crush unlocked'],
    ['Started generating', 'Cooking something hot'],
    // The scene Tagger's match results
    ['No results found', 'No match. Playing hard to get.'],
    ['Scene already tagged', 'Already spoken for'],
    ['Scene successfully tagged', 'Tagged and bagged'],
  ])

  const EMPTY_STATES = new Set(['No results found.'])

  // Stash marks an empty list with nothing but "0-0 of 0" in .paginationIndex.
  const EMPTY_LIST_LINE = 'Nothing juicy here. Yet.'

  const state = {
    calm: false,
    cheeky: true,
    insights: false,
    toolkit: false,
  }

  // The two restyle settings, for the Insights and Performers Toolkit
  // plugins: each is a class on <html> that its plugin's CSS waits for, kept
  // from the last visit, so a page the plugin draws on never shows it in its
  // own colours while the settings load
  const RESTYLES = {
    insights: {
      setting: 'restyleInsights',
      className: 'juicy-restyle-insights',
    },
    toolkit: {
      setting: 'restylePerformersToolkit',
      className: 'juicy-restyle-toolkit',
    },
  }
  const RESTYLE_KEY = 'juicy.restyle'

  function keptRestyles() {
    try {
      const kept = JSON.parse(localStorage.getItem(RESTYLE_KEY)) ?? {}
      return Object.fromEntries(
        Object.keys(RESTYLES).map((key) => [key, kept[key] === true]),
      )
    } catch {
      return {}
    }
  }

  const originals = new WeakMap()

  function sfwMode() {
    return document.querySelector('.sfw-content-mode') !== null
  }

  function wantCheeky() {
    return state.cheeky && !sfwMode()
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  // Cheeky copy -------------------------------------------------------------

  function rewriteTextNode(node) {
    const text = node.nodeValue.trim()
    const cheeky = CHEEKY_COPY.get(text)
    if (cheeky === undefined) return
    originals.set(node, node.nodeValue)
    node.nodeValue = node.nodeValue.replace(text, cheeky)
    if (EMPTY_STATES.has(text) && node.parentElement) {
      node.parentElement.classList.add('juicy-empty')
    }
  }

  function restoreTextNode(node) {
    const original = originals.get(node)
    if (original === undefined) return
    node.nodeValue = original
    originals.delete(node)
    if (node.parentElement) node.parentElement.classList.remove('juicy-empty')
  }

  function walkText(start, visit) {
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (
          !parent ||
          parent.closest(
            'input, textarea, [contenteditable], [data-juicy-plain]',
          )
        ) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      visit(node)
    }
  }

  // Without the cheek (Plain labels or SFW mode) the empty list keeps a heart
  // and no line.
  function markEmptyLists() {
    for (const index of document.querySelectorAll('.paginationIndex')) {
      const empty = /^0-0 of 0\b/.test(index.textContent.trim())
      if (empty) {
        index.dataset.juicyEmpty = wantCheeky() ? EMPTY_LIST_LINE : ''
      } else {
        delete index.dataset.juicyEmpty
      }
    }
  }

  function applyCopy(start) {
    walkText(start, wantCheeky() ? rewriteTextNode : restoreTextNode)
    markEmptyLists()
  }

  // Only nodes React adds or rewrites are checked, so a long scene grid costs
  // nothing after its first render.
  const queue = new Set()
  let pending = false

  function flush() {
    pending = false
    const nodes = [...queue]
    queue.clear()
    for (const node of nodes) {
      if (!node.isConnected) continue
      if (node.nodeType === Node.TEXT_NODE) {
        if (wantCheeky()) rewriteTextNode(node)
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        applyCopy(node)
      }
    }
    markEmptyLists()
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') queue.add(record.target)
      for (const node of record.addedNodes) queue.add(node)
    }
    if (pending || queue.size === 0) return
    pending = true
    window.requestAnimationFrame(flush)
  })

  // Heart burst -------------------------------------------------------------

  function burst(x, y) {
    if (state.calm || reducedMotion()) return
    const kinds = sfwMode() ? ['', 'is-sparkle'] : ['', 'is-sparkle', 'is-drip']
    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9 + Math.random() * 0.5
      const distance = 36 + Math.random() * 34
      const particle = document.createElement('span')
      particle.className = `juicy-burst ${kinds[i % kinds.length]}`
      particle.style.left = `${x}px`
      particle.style.top = `${y}px`
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
      particle.style.setProperty('--spin', `${Math.random() * 120 - 60}deg`)
      particle.addEventListener('animationend', () => particle.remove())
      document.body.appendChild(particle)
    }
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null
    const button = target?.closest(
      '.rating-stars button, .favorite-button.not-favorite, .count-button:has(svg:not(.svg-inline--fa)) .count-icon',
    )
    if (!button || button.disabled) return
    const box = button.getBoundingClientRect()
    burst(box.left + box.width / 2, box.top + box.height / 2)
  }

  // Settings ----------------------------------------------------------------

  // The cheek the whole page was last walked with. apply walks it again only
  // when that changes, by Plain labels or SFW mode (on the design-system page
  // too); the observer keeps up with the page in between.
  let walkedCheeky

  function apply(next) {
    Object.assign(state, next)
    root.classList.toggle('juicy-calm', state.calm)
    for (const [key, { className }] of Object.entries(RESTYLES))
      root.classList.toggle(className, state[key] === true)
    if (Object.keys(RESTYLES).some((key) => key in next)) {
      try {
        localStorage.setItem(
          RESTYLE_KEY,
          JSON.stringify({ insights: state.insights, toolkit: state.toolkit }),
        )
      } catch {
        // A browser without storage loads the settings each visit.
      }
    }
    if (document.body && wantCheeky() !== walkedCheeky) {
      walkedCheeky = wantCheeky()
      applyCopy(document.body)
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ configuration { plugins } }' }),
      })
      if (!response.ok) return
      const body = await response.json()
      const settings = body?.data?.configuration?.plugins?.[PLUGIN_ID] ?? {}
      apply({
        calm: settings.calmMode === true,
        cheeky: settings.plainCopy !== true,
        ...Object.fromEntries(
          Object.entries(RESTYLES).map(([key, { setting }]) => [
            key,
            settings[setting] === true,
          ]),
        ),
      })
    } catch {
      // Not running inside Stash; keep the defaults.
    }
  }

  function start() {
    root.classList.add('juicy')
    document.addEventListener('click', onClick, true)
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    apply(keptRestyles())
    if (window.PluginApi) {
      loadSettings()
      // The settings are read again on every page Stash opens, so changing
      // one takes effect on the next page, with no reload
      window.PluginApi.Event?.addEventListener('stash:location', loadSettings)
    }
  }

  window.Juicy = { apply, burst, copy: CHEEKY_COPY }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
