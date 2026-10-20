// The game feel of the bracket map, from what a Stash UI plugin has: CSS,
// the Web Animations API, one canvas, Web Audio and the Gamepad API. No
// library and no asset files: the sounds are synthesised, the sparks drawn.
// Brackets Classic Mode (the classicBrackets setting) uses none of it.
//
// - calm(): prefers-reduced-motion. Bursts and flights stop and matches
//   swap at once, so nothing waits on an animation.
// - theme(): the theme's accent and the dialog's surface, read from a
//   Bootstrap .btn-primary inside the dialog, since Stash defines no CSS
//   custom properties a plugin could read; any theme's accent becomes the
//   map's.
// - sfx: off until the viewer turns it on; remembered in this browser.
// - fx: one fixed canvas over Stash's modal layer for sparks and confetti;
//   it sleeps when nothing moves.
// - useGamepad: a controller's d-pad picks.
import { React } from '../../../runtime/api.js'

export const calm = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// ------------------------------------------------------------ theme

const parse = (c) => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(
    c || '',
  )
  if (!m || m[4] === '0') return null
  return [+m[1], +m[2], +m[3]]
}

// The first painted background among these: Stash paints its dialogs'
// header and body, not .modal-content
const surfaceOf = (els) => {
  for (const el of els) {
    const c = el && parse(getComputedStyle(el).backgroundColor)
    if (c) return c
  }
  return [20, 20, 24]
}

// The theme's accent, the text on it and the dialog's surface, as CSS
// custom properties on `el` (and returned, for the canvas)
export function theme(el) {
  if (!el) return null
  const host = el.closest('.modal-content') || el
  const probe = document.createElement('button')
  probe.className = 'btn btn-primary'
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none'
  host.appendChild(probe)
  const cs = getComputedStyle(probe)
  // a theme with a transparent primary button: its border, then its text
  const accent = parse(cs.backgroundColor) ||
    parse(cs.borderTopColor) ||
    parse(cs.color) || [255, 200, 0]
  const on = parse(cs.color) || [255, 255, 255]
  probe.remove()
  const surface = surfaceOf([
    host.querySelector('.modal-body'),
    host,
    host.querySelector('.modal-header'),
    document.body,
  ])
  const vars = {
    '--cherrypick-accent': `rgb(${accent.join(' ')})`,
    '--cherrypick-accent-rgb': accent.join(' '),
    '--cherrypick-on-accent': `rgb(${on.join(' ')})`,
    '--cherrypick-surface': `rgb(${surface.join(' ')})`,
  }
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  return { accent, on, surface }
}

export function useTheme(ref) {
  const [t, setT] = React.useState(null)
  React.useLayoutEffect(() => {
    setT(theme(ref.current))
  }, [ref])
  return t
}

// ------------------------------------------------------------ sound

const SOUND_KEY = 'cherrypick-bracket-sound'
let soundOn = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
})()
const soundListeners = new Set()

export function useSound() {
  const [on, setOn] = React.useState(soundOn)
  React.useEffect(() => {
    soundListeners.add(setOn)
    return () => soundListeners.delete(setOn)
  }, [])
  return [on, toggleSound]
}

export function toggleSound() {
  soundOn = !soundOn
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off')
  } catch {
    // a private window: on for this visit only
  }
  for (const f of soundListeners) f(soundOn)
  if (soundOn) sfx('coin')
}

let ctx = null
let master = null
let noiseBuf = null
function audio() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.22
  master.connect(ctx.destination)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

function tone(t0, { f0, f1 = f0, dur, type = 'square', vol = 0.5 }) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t0)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise(t0, { dur, f0, f1 = f0, vol = 0.5 }) {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(f0, t0)
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  s.connect(f).connect(g).connect(master)
  s.start(t0)
  s.stop(t0 + dur + 0.02)
}

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12)

const SOUNDS = {
  // a pick
  coin: (t) => {
    tone(t, { f0: NOTE(83), dur: 0.07, vol: 0.25 })
    tone(t + 0.07, { f0: NOTE(88), dur: 0.28, vol: 0.25 })
  },
  // the cherries move on
  hop: (t) => tone(t, { f0: 330, f1: 700, dur: 0.12, vol: 0.18 }),
  // a match pops up out of the map
  pop: (t) => noise(t, { dur: 0.12, f0: 900, f1: 2600, vol: 0.18 }),
  // Undo
  rewind: (t) =>
    tone(t, { f0: 900, f1: 180, dur: 0.26, type: 'sawtooth', vol: 0.12 }),
  // a new round
  round: (t) =>
    [72, 76, 79, 84].forEach((n, i) =>
      tone(t + i * 0.08, { f0: NOTE(n), dur: 0.12, vol: 0.18 }),
    ),
  // the champion loses its Challenge round
  lose: (t) =>
    [67, 63, 60].forEach((n, i) =>
      tone(t + i * 0.14, {
        f0: NOTE(n),
        dur: 0.2,
        type: 'triangle',
        vol: 0.18,
      }),
    ),
  // a champion, or a trophy
  fanfare: (t) => {
    ;[67, 72, 76, 79].forEach((n, i) =>
      tone(t + i * 0.1, { f0: NOTE(n), dur: 0.14, vol: 0.18 }),
    )
    ;[72, 76, 79, 84].forEach((n) =>
      tone(t + 0.42, { f0: NOTE(n), dur: 1.1, type: 'triangle', vol: 0.16 }),
    )
  },
}

// Plays a named sound when the viewer turned sound on. Browsers let a page
// start audio only after a click or key, and every bracket sound follows one.
export function sfx(name, delay = 0) {
  if (!soundOn || !SOUNDS[name] || !audio()) return
  if (ctx.state === 'suspended') ctx.resume()
  SOUNDS[name](ctx.currentTime + delay / 1000)
}

// A tap of the phone's vibration motor, where there is one (Android
// browsers; iOS has no Vibration API)
export const haptic = (p = 12) => {
  if (!calm()) navigator.vibrate?.(p)
}

// ------------------------------------------------------------ motion

// Ends every finite animation under `root` at once: a click or key while
// the next match arrives skips the arrival instead of picking a match the
// viewer has not seen yet
export function finishAll(root) {
  if (!root?.getAnimations) return
  for (const a of root.getAnimations({ subtree: true })) {
    const it = a.effect?.getComputedTiming?.().iterations
    if (it !== Infinity && a.playState !== 'finished') {
      try {
        a.finish()
      } catch {
        // an animation removed under us
      }
    }
  }
}

// A clone of `from` flown to `to` over the page, then removed: a winner's
// picture flying from the match into its next place on the map. Resolves
// on landing.
export function fly(from, to, { ms = 380, radius = '50%', arc = 40 } = {}) {
  if (!from || !to || calm()) return Promise.resolve()
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  if (!a.width || !b.width) return Promise.resolve()
  const clone = from.cloneNode(true)
  clone.removeAttribute('id')
  Object.assign(clone.style, {
    position: 'fixed',
    left: a.left + 'px',
    top: a.top + 'px',
    width: a.width + 'px',
    height: a.height + 'px',
    margin: 0,
    zIndex: 1071,
    pointerEvents: 'none',
    transformOrigin: '0 0',
    overflow: 'hidden',
  })
  clone.classList.add('cherrypick-flying')
  document.body.appendChild(clone)
  const sx = b.width / a.width
  const sy = b.height / a.height
  const dx = b.left - a.left
  const dy = b.top - a.top
  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1,1)', borderRadius: '6px' },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`,
        offset: 0.5,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        borderRadius: radius,
      },
    ],
    { duration: ms, easing: 'cubic-bezier(.5,0,.3,1)' },
  )
  return anim.finished.then(
    () => clone.remove(),
    () => clone.remove(),
  )
}

// ------------------------------------------------------------ particles

let canvas = null
let g2d = null
let parts = []
let raf = 0

function ensureCanvas() {
  if (canvas?.isConnected) return
  canvas = document.createElement('canvas')
  canvas.className = 'cherrypick-fx-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  g2d = canvas.getContext('2d')
  size()
  window.addEventListener('resize', size)
}

function size() {
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  g2d.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function frame() {
  g2d.clearRect(0, 0, innerWidth, innerHeight)
  const now = performance.now()
  parts = parts.filter((p) => now - p.born < p.life + p.delay)
  for (const p of parts) {
    const t = now - p.born - p.delay
    if (t < 0) continue
    const dt = 1 / 60
    p.vy += p.g * dt
    p.vx *= p.drag
    p.vy *= p.drag
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vr * dt
    const k = 1 - t / p.life
    g2d.globalAlpha = Math.max(0, p.fade ? k : Math.min(1, k * 3))
    g2d.fillStyle = p.color
    g2d.strokeStyle = p.color
    if (p.shape === 'spark') {
      g2d.lineWidth = p.size
      g2d.beginPath()
      g2d.moveTo(p.x, p.y)
      g2d.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04)
      g2d.stroke()
    } else if (p.shape === 'confetti') {
      g2d.save()
      g2d.translate(p.x, p.y)
      g2d.rotate(p.rot)
      g2d.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      g2d.restore()
    } else {
      g2d.beginPath()
      g2d.arc(p.x, p.y, p.size * k, 0, Math.PI * 2)
      g2d.fill()
    }
  }
  g2d.globalAlpha = 1
  if (parts.length) raf = requestAnimationFrame(frame)
  else {
    raf = 0
    g2d.clearRect(0, 0, innerWidth, innerHeight)
  }
}

function add(list) {
  if (calm()) return
  ensureCanvas()
  const now = performance.now()
  for (const p of list)
    parts.push({
      born: now,
      delay: 0,
      g: 0,
      drag: 0.98,
      rot: 0,
      vr: 0,
      fade: true,
      ...p,
    })
  if (!raf) raf = requestAnimationFrame(frame)
}

const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
const mix = (c, w) => c.map((v) => Math.round(v + (255 - v) * w))
const centre = (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export const fx = {
  // sparks flying out of an element's centre
  burst(el, color, { n = 28, speed = 520, size = 2.5, life = 520 } = {}) {
    const p = centre(el)
    const list = []
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.8)
      list.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 0.9,
        shape: 'spark',
        size: size * (0.6 + Math.random()),
        life: life * (0.6 + Math.random() * 0.6),
        color: rgb(i % 3 ? color : mix(color, 0.7)),
      })
    }
    add(list)
  },
  // confetti from the top of an element
  confetti(color, el, n = 140) {
    const r = el.getBoundingClientRect()
    const shades = [color, mix(color, 0.45), mix(color, 0.8), [255, 255, 255]]
    const list = []
    for (let i = 0; i < n; i++)
      list.push({
        x: r.left + Math.random() * r.width,
        y: r.top - 10,
        vx: (Math.random() - 0.5) * 260,
        vy: 80 + Math.random() * 260,
        g: 260,
        drag: 0.985,
        vr: (Math.random() - 0.5) * 12,
        rot: Math.random() * 6,
        shape: 'confetti',
        size: 7 + Math.random() * 6,
        life: 1800 + Math.random() * 1200,
        delay: Math.random() * 400,
        fade: false,
        color: rgb(shades[i % shades.length]),
      })
    add(list)
  },
  // a ring of soft dots where a winner lands on the map
  puff(el, color, n = 14) {
    const p = centre(el)
    const list = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      list.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * 160,
        vy: Math.sin(a) * 160,
        drag: 0.86,
        size: 4,
        life: 420,
        color: rgb(mix(color, 0.3)),
      })
    }
    add(list)
  },
}

// ------------------------------------------------------------ gamepad

// A controller's d-pad or left stick picks a side, B undoes, Y shows the
// bracket; `any` is any button. Polled while `active`; a press counts once.
export function useGamepad(active, on) {
  const latest = React.useRef(on)
  latest.current = on
  const [pads, setPads] = React.useState(0)
  React.useEffect(() => {
    const count = () =>
      setPads([...(navigator.getGamepads?.() || [])].filter(Boolean).length)
    window.addEventListener('gamepadconnected', count)
    window.addEventListener('gamepaddisconnected', count)
    count()
    return () => {
      window.removeEventListener('gamepadconnected', count)
      window.removeEventListener('gamepaddisconnected', count)
    }
  }, [])
  React.useEffect(() => {
    if (!active || !pads) return
    let id = 0
    const held = new Set()
    const loop = () => {
      for (const gp of navigator.getGamepads?.() || []) {
        if (!gp) continue
        const ax = gp.axes[0] || 0
        const now = {
          left: gp.buttons[14]?.pressed || ax < -0.6,
          right: gp.buttons[15]?.pressed || ax > 0.6,
          undo: gp.buttons[1]?.pressed,
          tree: gp.buttons[3]?.pressed,
          any: gp.buttons.some((b) => b.pressed),
        }
        for (const [k, v] of Object.entries(now)) {
          const key = gp.index + k
          if (v && !held.has(key)) {
            held.add(key)
            latest.current[k]?.()
          } else if (!v) held.delete(key)
        }
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active, pads])
  return pads
}
