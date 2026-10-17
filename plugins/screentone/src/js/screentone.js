// Screentone's JavaScript extras: sparkle bursts on rating, the tsundere copy
// and the calm switch. Everything here is optional decoration: the theme is
// complete in CSS, and this file degrades to nothing when PluginApi or GraphQL
// are missing (as on the design-system page).
;(function () {
  'use strict'

  const PLUGIN_ID = 'Theme-Screentone'
  const root = document.documentElement

  // Stash's own wording mapped to hers: the tsundere, manga's own brat, huffy,
  // teasing and secretly pleased, with one "baka" in the whole theme, as
  // translated manga keep it. Exact, whole-text matches only, so user content
  // (titles, tags, descriptions) is never touched.
  const TSUNDERE_COPY = new Map([
    ['Loading…', 'It’s not like I loaded this for you.'],
    ['Loading plugins…', 'Ugh. Fine. Plugins…'],
    ['No results found.', 'Nothing. Stop staring.'],
    ['No tasks are currently running.', 'Nothing running. Not that I care.'],
    // フン (hmph) is drawn over every toast, so the line does not say it again
    ['Performer Favourited', 'Good taste. For once.'],
    ['Started generating', 'I’m doing it. Don’t watch.'],
    // The scene Tagger's match results
    ['No results found', 'No match. Not my fault.'],
    ['Scene already tagged', 'Already tagged, baka.'],
    ['Scene successfully tagged', 'Tagged. Don’t thank me.'],
  ])

  const EMPTY_STATES = new Set(['No results found.'])

  // Stash marks an empty list with nothing but "0-0 of 0" in .paginationIndex.
  const EMPTY_LIST_LINE = 'Empty. Ask nicely next time.'

  // White sparkles, focus-line streaks, red stars and sweat drops; SFW mode
  // keeps the sparkles and the streaks.
  const PARTICLES = [
    '',
    'is-line',
    'is-red',
    'is-line',
    'is-drop',
    '',
    'is-line',
    'is-red',
    '',
    'is-line',
    'is-drop',
    'is-line',
  ]
  const SFW_PARTICLES = ['', 'is-line']

  const state = {
    calm: false,
    voice: true,
  }

  const originals = new WeakMap()

  function sfwMode() {
    return document.querySelector('.sfw-content-mode') !== null
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function wantVoice() {
    return state.voice && !sfwMode()
  }

  // Her copy -----------------------------------------------------------------

  function rewriteTextNode(node) {
    const text = node.nodeValue.trim()
    const line = TSUNDERE_COPY.get(text)
    if (line === undefined) return
    originals.set(node, node.nodeValue)
    node.nodeValue = node.nodeValue.replace(text, line)
    if (EMPTY_STATES.has(text) && node.parentElement) {
      node.parentElement.classList.add('screentone-empty')
    }
  }

  function restoreTextNode(node) {
    const original = originals.get(node)
    if (original === undefined) return
    node.nodeValue = original
    originals.delete(node)
    if (node.parentElement) {
      node.parentElement.classList.remove('screentone-empty')
    }
  }

  function walkText(start, visit) {
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (
          !parent ||
          parent.closest(
            'input, textarea, [contenteditable], [data-screentone-plain]',
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

  // Without the voice (Plain labels or SFW mode) the empty list keeps its
  // picture and no line.
  function markEmptyLists() {
    for (const index of document.querySelectorAll('.paginationIndex')) {
      const empty = /^0-0 of 0\b/.test(index.textContent.trim())
      if (empty) {
        index.dataset.screentoneEmpty = wantVoice() ? EMPTY_LIST_LINE : ''
      } else {
        delete index.dataset.screentoneEmpty
      }
    }
  }

  function applyCopy(start) {
    walkText(start, wantVoice() ? rewriteTextNode : restoreTextNode)
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
        if (wantVoice()) rewriteTextNode(node)
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

  // Sparkle burst ------------------------------------------------------------

  function burst(x, y) {
    if (state.calm || reducedMotion()) return
    const kinds = sfwMode() ? SFW_PARTICLES : PARTICLES
    const count = 12
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const distance = 30 + Math.random() * 38
      const particle = document.createElement('span')
      particle.className = `screentone-burst ${kinds[i % kinds.length]}`
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

  // Settings -----------------------------------------------------------------

  function apply(next) {
    Object.assign(state, next)
    root.classList.toggle('screentone-calm', state.calm)
    if (document.body) applyCopy(document.body)
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
        voice: settings.plainCopy !== true,
      })
    } catch {
      // Not running inside Stash; keep the defaults.
    }
  }

  function start() {
    root.classList.add('screentone')
    document.addEventListener('click', onClick, true)
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    apply({})
    if (window.PluginApi) loadSettings()
  }

  window.Screentone = {
    apply,
    burst,
    copy: TSUNDERE_COPY,
    emptyLine: EMPTY_LIST_LINE,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
