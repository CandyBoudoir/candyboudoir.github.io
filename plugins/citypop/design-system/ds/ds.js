// Design-system page wiring: the folded navbar, the "Try it" switches, the
// demo rating, favourite and O counter, and the audio-only cassette. The
// theme's own behaviour lives in citypop.js.
;(function () {
  'use strict'

  const cityPop = window.CityPop
  const main = document.getElementById('ds-main')

  const toggler = document.getElementById('ds-toggler')
  toggler.addEventListener('click', () => {
    const open = document.getElementById('ds-nav').classList.toggle('show')
    toggler.setAttribute('aria-expanded', String(open))
  })

  document.getElementById('ds-calm').addEventListener('change', (event) => {
    cityPop.apply({ calm: event.target.checked })
  })

  document.getElementById('ds-plain').addEventListener('change', (event) => {
    cityPop.apply({ voice: !event.target.checked })
  })

  document.getElementById('ds-sfw').addEventListener('change', (event) => {
    main.classList.toggle('sfw-content-mode', event.target.checked)
    cityPop.apply({})
  })

  // The same cassette citypop.js lays on an audio-only scene in Stash
  document.getElementById('ds-audio').append(cityPop.audioCover())

  const rating = document.getElementById('ds-rating')
  rating.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-star]')
    if (!button) return
    const value = Number(button.dataset.star)
    for (const star of rating.querySelectorAll('button[data-star]')) {
      const filled = Number(star.dataset.star) <= value
      star.classList.toggle('star-fill-100', filled)
      star.classList.toggle('star-fill-0', !filled)
    }
    rating.querySelector('.star-rating-number').textContent = String(value)
  })

  for (const button of document.querySelectorAll('.favorite-button')) {
    button.addEventListener('click', () => {
      const on = button.classList.toggle('favorite')
      button.classList.toggle('not-favorite', !on)
    })
  }

  const oCounter = document.querySelector('#ds-o .count-value span')
  document.querySelector('#ds-o .count-icon').addEventListener('click', () => {
    oCounter.textContent = String(Number(oCounter.textContent) + 1)
  })

  const rows = document.getElementById('ds-copy-rows')
  const row = (plain, line) => {
    const tr = document.createElement('tr')
    for (const text of [plain, line]) {
      const td = document.createElement('td')
      td.dataset.citypopPlain = ''
      td.textContent = text
      tr.append(td)
    }
    rows.append(tr)
  }
  for (const [plain, line] of cityPop.copy) row(plain, line)
  row('0-0 of 0 (an empty list)', cityPop.emptyLine)
})()
