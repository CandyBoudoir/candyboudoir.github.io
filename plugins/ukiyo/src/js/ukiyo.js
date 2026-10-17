// Ukiyo's JavaScript extras: petal and foam bursts, the oiran's copy and the
// calm switch. Everything here is optional decoration: the theme is complete
// in CSS, and this file degrades to nothing when PluginApi or GraphQL are
// missing (as on the design-system page).
;(function () {
  'use strict'

  const PLUGIN_ID = 'Theme-Ukiyo'
  const root = document.documentElement

  // Stash's own wording mapped to the oiran's. Exact, whole-text matches only,
  // so user content (titles, tags, descriptions) is never touched. Every line
  // comes from a real custom of the Yoshiwara or from the printer's craft,
  // never from her costume: she did not speak at a first meeting (shokai),
  // accepted a patron only on his third visit (najimi), could refuse whom she
  // pleased and sealed her letters in red; blocks are cut, ink dries, a print
  // is sealed.
  const OIRAN_COPY = new Map([
    ['Loading…', 'First meeting. I do not speak yet.'],
    ['Loading plugins…', 'The ink is still drying.'],
    ['No results found.', 'I refuse them all.'],
    ['No tasks are currently running.', 'The blocks are idle. For now.'],
    ['Performer Favourited', 'Sealed in red.'],
    ['Started generating', 'The blocks are being cut.'],
    // The scene Tagger's match results
    ['No results found', 'No match. Look again.'],
    ['Scene already tagged', 'Already bears my seal.'],
    ['Scene successfully tagged', 'Printed, and sealed.'],
  ])

  const EMPTY_STATES = new Set(['No results found.'])

  // Stash marks an empty list with nothing but "0-0 of 0" in .paginationIndex.
  const EMPTY_LIST_LINE = 'Come back a third time. Then, perhaps.'

  // Petals, blossoms, foam and flecks of mica; SFW mode keeps petals and foam.
  const PARTICLES = [
    '',
    'is-foam',
    'is-blossom',
    '',
    'is-foam',
    'is-mica',
    '',
    'is-foam',
  ]
  const SFW_PARTICLES = ['', 'is-foam']

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

  // The oiran's copy ---------------------------------------------------------

  function rewriteTextNode(node) {
    const text = node.nodeValue.trim()
    const line = OIRAN_COPY.get(text)
    if (line === undefined) return
    originals.set(node, node.nodeValue)
    node.nodeValue = node.nodeValue.replace(text, line)
    if (EMPTY_STATES.has(text) && node.parentElement) {
      node.parentElement.classList.add('ukiyo-empty')
    }
  }

  function restoreTextNode(node) {
    const original = originals.get(node)
    if (original === undefined) return
    node.nodeValue = original
    originals.delete(node)
    if (node.parentElement) node.parentElement.classList.remove('ukiyo-empty')
  }

  function walkText(start, visit) {
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (
          !parent ||
          parent.closest(
            'input, textarea, [contenteditable], [data-ukiyo-plain]',
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

  // The beauty print and her line come and go together: without the voice
  // (Plain labels or SFW mode) an empty list keeps Stash's own "0-0 of 0".
  function markEmptyLists() {
    for (const index of document.querySelectorAll('.paginationIndex')) {
      const empty = /^0-0 of 0\b/.test(index.textContent.trim())
      if (empty && wantVoice()) {
        index.dataset.ukiyoEmpty = EMPTY_LIST_LINE
      } else {
        delete index.dataset.ukiyoEmpty
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

  // Petal burst --------------------------------------------------------------

  function burst(x, y) {
    if (state.calm || reducedMotion()) return
    const kinds = sfwMode() ? SFW_PARTICLES : PARTICLES
    const count = 12
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const distance = 38 + Math.random() * 44
      const particle = document.createElement('span')
      particle.className = `ukiyo-burst ${kinds[i % kinds.length]}`
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

  function apply(next) {
    Object.assign(state, next)
    root.classList.toggle('ukiyo-calm', state.calm)
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
    root.classList.add('ukiyo')
    document.addEventListener('click', onClick, true)
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    apply({})
    if (window.PluginApi) loadSettings()
  }

  window.Ukiyo = {
    apply,
    burst,
    copy: OIRAN_COPY,
    emptyLine: EMPTY_LIST_LINE,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
