// Design-system page wiring: the "Try it" switches and the demo ratings,
// favourite and O counter. The theme's own behaviour lives in juicy.js.
;(function () {
  'use strict'

  const juicy = window.Juicy
  const main = document.getElementById('ds-main')

  document.getElementById('ds-calm').addEventListener('change', (event) => {
    juicy.apply({ calm: event.target.checked })
  })

  document.getElementById('ds-plain').addEventListener('change', (event) => {
    juicy.apply({ cheeky: !event.target.checked })
  })

  document.getElementById('ds-sfw').addEventListener('change', (event) => {
    main.classList.toggle('sfw-content-mode', event.target.checked)
    juicy.apply({})
  })

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
  for (const [plain, cheeky] of juicy.copy) {
    const row = document.createElement('tr')
    const before = document.createElement('td')
    before.dataset.juicyPlain = ''
    before.textContent = plain
    const after = document.createElement('td')
    after.dataset.juicyPlain = ''
    after.textContent = cheeky
    row.append(before, after)
    rows.append(row)
  }
})()
