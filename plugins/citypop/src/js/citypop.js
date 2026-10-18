// City Pop's JavaScript extras: the late-night FM host's lines, bursts on
// rating, favouriting and the O counter, the calm switch and the cassette on
// audio-only scenes. Everything here is optional decoration: the theme is
// complete in CSS, and this file asks Stash for nothing when PluginApi is
// missing (as on the design-system page).
;(function () {
  'use strict'

  const PLUGIN_ID = 'Theme-CityPop'
  const root = document.documentElement

  // Stash's own wording mapped to hers: a Tokyo late-night FM host, in
  // earnest. Request postcards, the air check (taping a broadcast off the
  // radio), side A and side B. She keeps you listening, praises you for it
  // and makes you wait. Exact, whole-text matches only, so user content
  // (titles, tags, descriptions) is never touched.
  const FM_COPY = new Map([
    ['Loading…', 'Stay on my frequency…'],
    ['Loading plugins…', 'Cueing up side B…'],
    ['No results found.', 'No postcards tonight. Keep listening.'],
    ['No tasks are currently running.', 'Dead air. Breathe slow for me.'],
    ['Performer Favourited', 'Heavy rotation.'],
    ['Started generating', 'Air check rolling. Don’t touch the dial.'],
    // The scene Tagger's match results
    ['No results found', 'No signal. Stay tuned.'],
    ['Scene already tagged', 'Already on the tape.'],
    ['Scene successfully tagged', 'Taped and labelled. Good listener.'],
  ])

  const EMPTY_STATES = new Set(['No results found.'])

  // Stash marks an empty list with nothing but "0-0 of 0" in .paginationIndex.
  const EMPTY_LIST_LINE = 'Nothing on this side. Not yet.'

  // Glints, striped suns and pool drops; SFW mode drops the drops.
  const PARTICLES = ['', 'is-sun', 'is-drop']
  const SFW_PARTICLES = ['', 'is-sun']

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

  // Her lines --------------------------------------------------------------

  function rewriteTextNode(node) {
    const text = node.nodeValue.trim()
    const line = FM_COPY.get(text)
    if (line === undefined) return
    originals.set(node, node.nodeValue)
    node.nodeValue = node.nodeValue.replace(text, line)
    if (EMPTY_STATES.has(text) && node.parentElement) {
      node.parentElement.classList.add('citypop-empty')
    }
  }

  function restoreTextNode(node) {
    const original = originals.get(node)
    if (original === undefined) return
    node.nodeValue = original
    originals.delete(node)
    if (node.parentElement) node.parentElement.classList.remove('citypop-empty')
  }

  function walkText(start, visit) {
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (
          !parent ||
          parent.closest(
            'input, textarea, [contenteditable], [data-citypop-plain]',
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
        index.dataset.citypopEmpty = wantVoice() ? EMPTY_LIST_LINE : ''
      } else {
        delete index.dataset.citypopEmpty
      }
    }
  }

  function applyCopy(start) {
    walkText(start, wantVoice() ? rewriteTextNode : restoreTextNode)
    markEmptyLists()
  }

  // Audio-only scenes ------------------------------------------------------
  //
  // Stash has no class for a scene without pictures, so this asks Stash which
  // of the scenes on screen have no video stream and no cover of their own,
  // and gives their sleeve a cassette laid across a pool at dusk. One request
  // per batch of new cards, answers kept for the visit, and nothing changes
  // when a request fails.

  const audio = new Map() // scene id -> true when audio-only
  const asked = new Set()
  let detection = true

  const AUDIO_QUERY = `query CityPopAudio($range: IntCriterionInput!) {
    findScenes(
      scene_filter: {
        id: $range
        is_missing: "cover"
        video_codec: { value: "", modifier: EQUALS }
      }
      filter: { per_page: -1 }
    ) { scenes { id } }
  }`

  function sceneId(card) {
    const link = card.querySelector('a[href*="/scenes/"]')
    const match = link?.getAttribute('href').match(/\/scenes\/(\d+)/)
    return match ? match[1] : null
  }

  // The cover's markup, also used by the design-system page
  function audioCover() {
    const cover = document.createElement('div')
    cover.className = 'citypop-audio-cover'
    cover.setAttribute('aria-hidden', 'true')
    cover.innerHTML =
      '<div class="citypop-tape">' +
      '<span class="citypop-tape-title" lang="ja">真夜中ラジオ</span>' +
      '<span class="citypop-tape-side" lang="ja">A面</span>' +
      '<span class="citypop-tape-glints"></span>' +
      '</div>'
    return cover
  }

  function dress(card, id) {
    const preview = card.querySelector('.scene-card-preview')
    if (!preview) return
    let cover = preview.querySelector(':scope > .citypop-audio-cover')
    if (audio.get(id)) {
      if (!cover) {
        cover = audioCover()
        preview.insertBefore(
          cover,
          preview.querySelector(':scope > .preview-scrubber'),
        )
      }
      cover.dataset.scene = id
      card.classList.add('citypop-audio')
    } else {
      cover?.remove()
      card.classList.remove('citypop-audio')
    }
  }

  async function ask(ids) {
    for (const id of ids) asked.add(id)
    const numbers = ids.map(Number)
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: AUDIO_QUERY,
          variables: {
            range: {
              value: Math.min(...numbers),
              value2: Math.max(...numbers),
              modifier: 'BETWEEN',
            },
          },
        }),
      })
      const body = response.ok ? await response.json() : null
      const scenes = body?.data?.findScenes?.scenes
      if (!Array.isArray(scenes)) throw new Error('no answer')
      const found = new Set(scenes.map((scene) => scene.id))
      for (const id of ids) audio.set(id, found.has(id))
      markAudio()
    } catch {
      // A Stash that answers differently keeps its own covers.
      detection = false
    }
  }

  function markAudio() {
    if (!detection) return
    const unknown = []
    for (const card of document.querySelectorAll('.scene-card')) {
      const id = sceneId(card)
      if (!id) continue
      if (audio.has(id)) dress(card, id)
      else if (!asked.has(id)) unknown.push(id)
    }
    if (unknown.length) ask([...new Set(unknown)])
  }

  // Only nodes React adds or rewrites are checked for copy, and the scene
  // cards only when React adds or redraws one, so a long scene grid costs
  // nothing after its first render.
  const queue = new Set()
  let pending = false
  let cardsChanged = false

  function touchesCards(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      (node.closest('.scene-card') !== null ||
        node.querySelector('.scene-card') !== null)
    )
  }

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
    if (cardsChanged && window.PluginApi) markAudio()
    cardsChanged = false
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') queue.add(record.target)
      for (const node of record.addedNodes) {
        if (node.classList?.contains('citypop-audio-cover')) continue
        queue.add(node)
        if (!cardsChanged && touchesCards(node)) cardsChanged = true
      }
    }
    if (pending || queue.size === 0) return
    pending = true
    window.requestAnimationFrame(flush)
  })

  // Bursts -----------------------------------------------------------------

  function burst(x, y) {
    if (state.calm || reducedMotion()) return
    const kinds = sfwMode() ? SFW_PARTICLES : PARTICLES
    const count = 12
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const distance = 34 + Math.random() * 36
      const particle = document.createElement('span')
      particle.className = `citypop-burst ${kinds[i % kinds.length]}`
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

  // Settings ---------------------------------------------------------------

  function apply(next) {
    Object.assign(state, next)
    root.classList.toggle('citypop-calm', state.calm)
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
    root.classList.add('citypop')
    document.addEventListener('click', onClick, true)
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    apply({})
    if (window.PluginApi) {
      loadSettings()
      markAudio()
    }
  }

  window.CityPop = {
    apply,
    audioCover,
    burst,
    copy: FM_COPY,
    emptyLine: EMPTY_LIST_LINE,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
