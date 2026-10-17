"""Screentone: glyph masks, motifs and SFX lettering, written as plain SVG.

The katakana and the bubble lettering are drawn as outlines from Dela Gothic
One and Caveat Brush (both SIL OFL 1.1): Dela's Latin and Caveat Brush come
from the fontsource packages the build bundles, and Dela's kana from the SFX
subset in src/fonts, so an SVG shown through <img> needs no web font. Caveat
Brush is slanted 12 degrees here, as the CSS slants it with font-style:
italic. The icons the plugin uses go to src/icons and the rest to the
design-system page.

usage, from the repo root after pnpm install (needs fonttools with brotli):
  uvx --from 'fonttools[woff]==4.66.1' python -I plugins/screentone/tools/icons.py
"""
import math
import os
import random

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.normpath(os.path.join(HERE, '..'))
SHIPPED = os.path.join(PLUGIN, 'src', 'icons')
PAGE = os.path.join(PLUGIN, 'design-system', 'ds', 'motifs')
FONTSOURCE = os.path.join(PLUGIN, '..', '..', 'node_modules', '@fontsource')
# Each name maps to the fonts that hold its characters, searched in order
FONTS = {
    'dela': [
        TTFont(os.path.join(FONTSOURCE, 'dela-gothic-one', 'files', 'dela-gothic-one-latin-400-normal.woff2')),
        TTFont(os.path.join(PLUGIN, 'src', 'fonts', 'dela-gothic-one', 'dela-gothic-one-sfx-400-normal.woff2')),
    ],
    'letter': [
        TTFont(os.path.join(FONTSOURCE, 'caveat-brush', 'files', 'caveat-brush-latin-400-normal.woff2')),
    ],
}
# The icons screentone.css draws; every other file is for the design-system page
USED = {'glyph-star.svg', 'glyph-star-empty.svg', 'shine-star.svg', 'glyph-heart.svg', 'glyph-heart-empty.svg',
        'shine-heart.svg', 'glyph-drop.svg', 'glyph-sparkle.svg', 'focus-overlay.svg', 'speed-overlay.svg',
        'silence.svg', 'tone-frame.svg'}

SPOT = '#e8173f'
LEAN = 12  # the bubble lettering's slant, in degrees
INK = '#000'
PAPER = '#fdfcf9'


def r(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def save(name, body, view, extra=''):
    x, y, w, h = view
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{r(x)} {r(y)} {r(w)} {r(h)}"{extra}>'
           f'{body}</svg>\n')
    with open(os.path.join(SHIPPED if name in USED else PAGE, name), 'w') as f:
        f.write(svg)


# Lettering ---------------------------------------------------------------
def letters(font, text, size, x=0.0, y=0.0, track=0.0, jitter=None, skew=0.0, sx=None):
    """Lay out text as one path. jitter: per character (dx, dy, rotate, scale)."""
    fonts = FONTS[font]
    s = size / fonts[0]['head'].unitsPerEm
    pen = SVGPathPen(None)
    bp = BoundsPen(None)
    cx = x
    for i, ch in enumerate(text):
        f = next(f for f in fonts if ord(ch) in f.getBestCmap())
        gs = f.getGlyphSet()
        hmtx = f['hmtx']
        name = f.getBestCmap()[ord(ch)]
        pen.glyphSet = bp.glyphSet = gs
        adv = hmtx[name][0]
        dx, dy, rot, sc = (jitter[i] if jitter and i < len(jitter) else (0, 0, 0, 1))
        scx = (sx[i] if sx and i < len(sx) else 1)
        mid = adv / 2
        t = (Transform()
             .translate(cx + dx, y + dy)
             .skew(math.radians(-skew), 0)
             .scale(s * sc * scx, -s * sc)
             .translate(mid, 360)
             .rotate(math.radians(-rot))
             .translate(-mid, -360))
        gs[name].draw(TransformPen(pen, t))
        gs[name].draw(TransformPen(bp, t))
        cx += (adv * s * sc * scx) + track
    return pen.getCommands(), bp.bounds


def union(*bs):
    bs = [b for b in bs if b]
    return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))


def box(b, pad):
    return (b[0] - pad, b[1] - pad, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad)


def inked(id_, d, fill, strokes):
    """One path drawn as stacked strokes, widest first, then the fill."""
    out = f'<defs><path id="{id_}" d="{d}"/></defs>'
    for colour, width in strokes:
        out += (f'<use href="#{id_}" fill="{colour}" stroke="{colour}" stroke-width="{r(width)}" '
                'stroke-linejoin="round"/>')
    out += f'<use href="#{id_}" fill="{fill}"/>'
    return out


# Shapes ------------------------------------------------------------------
def star_path(cx, cy, R, ri, bow=0.86, rot=-90):
    """A hand-inked five-point star: sharp points, edges bowed slightly in."""
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36)
        rad = R if i % 2 == 0 else ri
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    d = f'M{r(pts[0][0])} {r(pts[0][1])}'
    for i in range(1, 11):
        p0 = pts[(i - 1) % 10]
        p1 = pts[i % 10]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        qx, qy = cx + (mx - cx) * bow, cy + (my - cy) * bow
        d += f'Q{r(qx)} {r(qy)} {r(p1[0])} {r(p1[1])}'
    return d + 'Z'


def sparkle_path(cx, cy, R, w=0.16):
    """A four-point sparkle with concave sides."""
    k = R * w
    return (f'M{r(cx)} {r(cy - R)}C{r(cx + k * 0.5)} {r(cy - k)} {r(cx + k)} {r(cy - k * 0.5)} {r(cx + R)} {r(cy)}'
            f'C{r(cx + k)} {r(cy + k * 0.5)} {r(cx + k * 0.5)} {r(cy + k)} {r(cx)} {r(cy + R)}'
            f'C{r(cx - k * 0.5)} {r(cy + k)} {r(cx - k)} {r(cy + k * 0.5)} {r(cx - R)} {r(cy)}'
            f'C{r(cx - k)} {r(cy - k * 0.5)} {r(cx - k * 0.5)} {r(cy - k)} {r(cx)} {r(cy - R)}Z')


HEART = ('M50 91C22 71 5 53 7 32C9 15 23 7 36 9C44 10 49 16 50 24C51 16 56 10 64 9'
         'C77 7 91 15 93 32C95 53 78 71 50 91Z')
HEART_SHINE = '<path d="M19 33C19 25 24 19 31 18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="18.5" cy="42" r="3.4" fill="#fff"/>'
DROP = 'M50 5C57 25 79 41 79 63A29 29 0 0 1 21 63C21 41 43 25 50 5Z'


def burst_path(cx, cy, R, ri, n, seed, jag=0.18):
    """A jagged impact burst: n spikes of uneven length."""
    rnd = random.Random(seed)
    d = ''
    for i in range(n * 2):
        a = 2 * math.pi * i / (n * 2) + rnd.uniform(-0.05, 0.05)
        rad = (R * rnd.uniform(1 - jag, 1) if i % 2 == 0 else ri * rnd.uniform(0.92, 1.05))
        d += ('M' if i == 0 else 'L') + f'{r(cx + rad * math.cos(a))} {r(cy + rad * math.sin(a))}'
    return d + 'Z'


def focus_wedges(cx, cy, r0, r1, n, seed, wmin=0.4, wmax=1.6):
    """Focus lines: thin wedges from an uneven inner ring out past the frame."""
    rnd = random.Random(seed)
    d = ''
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.6, 0.6) * (math.pi / n)
        w = math.radians(rnd.uniform(wmin, wmax)) / 2
        start = r0 * rnd.uniform(0.85, 1.35)
        tip = (cx + start * math.cos(a), cy + start * math.sin(a))
        e1 = (cx + r1 * math.cos(a - w), cy + r1 * math.sin(a - w))
        e2 = (cx + r1 * math.cos(a + w), cy + r1 * math.sin(a + w))
        d += f'M{r(tip[0])} {r(tip[1])}L{r(e1[0])} {r(e1[1])}L{r(e2[0])} {r(e2[1])}Z'
    return d


def speed_lines(x0, x1, y0, y1, n, seed, tmax=3.0):
    """Horizontal speed lines: tapered strokes of uneven length."""
    rnd = random.Random(seed)
    d = ''
    for _ in range(n):
        y = rnd.uniform(y0, y1)
        t = rnd.uniform(0.6, tmax)
        a = rnd.uniform(x0, x0 + (x1 - x0) * 0.45)
        b = rnd.uniform(a + (x1 - x0) * 0.25, x1)
        d += f'M{r(a)} {r(y)}L{r(b)} {r(y - t / 2)}L{r(b)} {r(y + t / 2)}Z'
    return d


def bubble_path(cx, cy, rx, ry, tail, root=112, spread=13):
    """An oval speech bubble with a curved tail leaving at angle root toward tail=(x, y)."""
    tx, ty = tail
    a0, a1 = math.radians(root - spread), math.radians(root + spread)
    p0 = (cx + rx * math.cos(a0), cy + ry * math.sin(a0))
    p1 = (cx + rx * math.cos(a1), cy + ry * math.sin(a1))
    bend = 6 if tx < cx else -6
    return (f'M{r(p0[0])} {r(p0[1])}A{r(rx)} {r(ry)} 0 1 0 {r(p1[0])} {r(p1[1])}'
            f'Q{r((p1[0] + tx) / 2 + bend)} {r((p1[1] + ty) / 2)} {r(tx)} {r(ty)}'
            f'Q{r((p0[0] + tx) / 2 + bend)} {r((p0[1] + ty) / 2)} {r(p0[0])} {r(p0[1])}Z')


def centred(font, text, size, cx, cy, track=0.0, **kw):
    """letters(), moved so its ink box is centred on (cx, cy)."""
    _, b = letters(font, text, size, 0, 0, track, **kw)
    return letters(font, text, size, cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2, track, **kw)


TONE_PATTERN = ('<pattern id="tn" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                '<rect width="7" height="7" fill="#2b2b2b"/><circle cx="3.5" cy="3.5" r="1.5" fill="#fdfcf9"/></pattern>')


# Glyph masks (one colour; the CSS paints them) -----------------------------
def glyphs():
    star = star_path(50, 53, 47, 20)
    save('glyph-star.svg', f'<path d="{star}"/>', (0, 0, 100, 100))
    save('glyph-star-empty.svg',
         f'<path d="{star_path(50, 53, 41, 17.5)}" fill="none" stroke="#000" stroke-width="9" stroke-linejoin="round"/>',
         (0, 0, 100, 100))
    # The glint inside a filled star, and the sparkle beside it
    save('shine-star.svg',
         f'<path d="{sparkle_path(37, 41, 13)}" fill="#fff"/><circle cx="57" cy="37" r="2.6" fill="#fff"/>',
         (0, 0, 100, 100))
    save('glyph-heart.svg', f'<path d="{HEART}"/>', (0, 0, 100, 100))
    save('glyph-heart-empty.svg',
         '<path d="M50 84C25 66 13 51 14 33C15 21 25 15 35 16C43 17 48 23 50 31C52 23 57 17 65 16'
         'C75 15 85 21 86 33C87 51 75 66 50 84Z" fill="none" stroke="#000" stroke-width="9" stroke-linejoin="round"/>',
         (0, 0, 100, 100))
    save('shine-heart.svg', HEART_SHINE, (0, 0, 100, 100))
    # The anime sweat drop: an inked outline and a highlight stroke
    save('glyph-drop.svg',
         f'<g transform="rotate(-14 50 55)"><path d="{DROP}" fill="none" stroke="#000" stroke-width="9" stroke-linejoin="round"/>'
         '<path d="M63 57C66 65 64 73 57 79" fill="none" stroke="#000" stroke-width="7.5" stroke-linecap="round"/></g>',
         (0, 0, 100, 100))
    save('glyph-sparkle.svg', f'<path d="{sparkle_path(46, 54, 44)}"/><path d="{sparkle_path(82, 18, 15)}"/>',
         (0, 0, 100, 100))


# Motifs ------------------------------------------------------------------
def motifs():
    # Focus lines round an empty centre
    save('focus-lines.svg',
         f'<path d="{focus_wedges(100, 100, 46, 150, 92, 7)}" fill="#fdfcf9"/>',
         (0, 0, 200, 200))
    # The same lines as a full-bleed overlay for card hover (slice to any panel)
    save('focus-overlay.svg',
         f'<path d="{focus_wedges(160, 90, 62, 260, 130, 11, 0.35, 1.3)}" fill="#fff"/>',
         (0, 0, 320, 180), ' preserveAspectRatio="xMidYMid slice"')
    save('speed-lines.svg',
         f'<path d="{speed_lines(0, 200, 30, 170, 46, 3, 3.4)}" fill="#fdfcf9"/>',
         (0, 0, 200, 200))
    save('speed-overlay.svg',
         f'<path d="{speed_lines(0, 320, 4, 176, 70, 5, 2.6)}" fill="#fff"/>',
         (0, 0, 320, 180), ' preserveAspectRatio="none"')
    # Gradient tone: dots on paper grow until they close up into beta
    dots = ''
    step = 9
    for row in range(27):
        for col in range(24):
            x = 6 + col * step + (step / 2 if row % 2 else 0)
            y = 6 + row * step * 0.866
            if x > 200 or y > 200:
                continue
            k = min(1, max(0, (x + y * 0.35 - 20) / 230))
            rad = 0.4 + k * 5.6
            dots += f'<circle cx="{r(x)}" cy="{r(y)}" r="{r(rad)}"/>'
    save('tone-gradient.svg',
         f'<rect width="200" height="200" fill="{PAPER}"/><g fill="#000">{dots}</g>'
         f'<rect x="3" y="3" width="194" height="194" fill="none" stroke="#000" stroke-width="6"/>',
         (0, 0, 200, 200))
    # Hatching: tapered parallel strokes, cross-hatched in one corner
    rnd = random.Random(4)
    hat = ''
    for i in range(30):
        o = -120 + i * 12 + rnd.uniform(-1.5, 1.5)
        t = rnd.uniform(1.8, 3.4)
        hat += f'M{r(o)} 210L{r(o + 210)} 0L{r(o + 210 + t)} 0L{r(o + t * 0.4)} 210Z'
    cross = ''
    for i in range(14):
        o = 40 + i * 12
        t = rnd.uniform(1.4, 2.6)
        cross += f'M{r(o)} 210L{r(o - 140)} 70L{r(o - 140 + t)} 70L{r(o + t * 0.4)} 210Z'
    save('hatching.svg',
         '<defs><clipPath id="c"><rect x="8" y="8" width="184" height="184"/></clipPath></defs>'
         f'<g clip-path="url(#c)" fill="{PAPER}"><path d="{hat}"/><path d="{cross}"/></g>'
         f'<rect x="5" y="5" width="190" height="190" fill="none" stroke="{PAPER}" stroke-width="5"/>',
         (0, 0, 200, 200))
    # A speech bubble with translated-manga lettering
    word, _ = centred('letter', 'HMPH.', 60, 100, 90, 1.5, skew=LEAN)
    save('bubble.svg',
         f'<path d="{bubble_path(100, 90, 86, 58, (40, 186))}" fill="{PAPER}" stroke="#000" stroke-width="5"/>'
         f'<path d="{word}" fill="#000"/>',
         (0, 0, 200, 200))
    # The silent bubble: nothing to say
    dots_, _ = centred('dela', '……', 44, 100, 90, 4)
    save('silence.svg',
         f'<path d="{bubble_path(100, 90, 86, 58, (162, 190), 62, 12)}" fill="{PAPER}" stroke="#000" stroke-width="5"/>'
         f'<path d="{dots_}" fill="#000"/>',
         (0, 0, 200, 200))
    # Sweat drop and inked star, as the motifs they come from
    save('drop.svg',
         f'<g transform="rotate(-14 50 55)"><path d="{DROP}" fill="#2b2b2b" stroke="{PAPER}" stroke-width="6" stroke-linejoin="round"/>'
         '<path d="M63 57C66 65 64 73 57 79" fill="none" stroke="#fdfcf9" stroke-width="5.5" stroke-linecap="round"/>'
         '<path d="M38 50C36 56 36 61 38 66" fill="none" stroke="#fdfcf9" stroke-width="2.5" stroke-linecap="round" opacity=".6"/></g>'
         f'<path d="{sparkle_path(86, 22, 11)}" fill="{PAPER}"/><path d="{sparkle_path(12, 82, 7)}" fill="{PAPER}"/>',
         (0, 0, 100, 100))
    save('star.svg',
         f'<path d="{star_path(50, 54, 44, 19)}" fill="{SPOT}" stroke="{PAPER}" stroke-width="4.5" stroke-linejoin="round"/>'
         f'<path d="{sparkle_path(38, 43, 12)}" fill="#fff"/>'
         f'<path d="{sparkle_path(88, 16, 10)}" fill="{PAPER}"/><path d="{sparkle_path(12, 22, 6)}" fill="{PAPER}"/>',
         (0, 0, 100, 100))
    save('heart.svg',
         f'<path d="{HEART}" fill="{SPOT}" stroke="{PAPER}" stroke-width="4.5" stroke-linejoin="round"/>{HEART_SHINE}',
         (0, 0, 100, 100))
    # Favicon: a red heart in focus lines on beta
    save('favicon.svg',
         f'<rect width="64" height="64" rx="8" fill="#000"/>'
         f'<path d="{focus_wedges(32, 32, 17, 48, 36, 2, 2.5, 5)}" fill="#fff"/>'
         f'<g transform="translate(13 14) scale(.38)"><path d="{HEART}" fill="{SPOT}" stroke="#fff" stroke-width="7"/></g>',
         (0, 0, 64, 64))
    # A small manga page: the panels icon
    save('panels.svg',
         '<g fill="none" stroke="#fdfcf9" stroke-width="5" stroke-linejoin="miter">'
         '<path d="M8 8H92V40L8 48Z"/><path d="M8 57L46 53V92H8Z"/><path d="M55 52L92 48V92H55Z"/></g>'
         '<path d="M14 15H86V35L14 42Z" fill="url(#tn)"/>'
         f'<defs>{TONE_PATTERN}</defs>',
         (0, 0, 100, 100))


def tone_frame():
    """The menu frame: a nine-slice border image, 25px square, sliced 8 12 12 8.

    A 2px white frame round the face (0..15) and a dotted tone L, 6px wide
    and 4px clear of the face, offset 6px down and right, on the 5px
    45-degree lattice the CSS screentone uses, so the middle slices tile.
    """
    def shadow(x, y):
        return (x >= 19 and y >= 6) or (y >= 19 and x >= 6)
    dots = ''
    for gy in range(-2, 7):
        for gx in range(-2, 7):
            for ox, oy in ((1.25, 1.25), (3.75, 3.75)):
                x, y = 8 + gx * 5 + ox, 8 + gy * 5 + oy
                if 0 <= x <= 25 and 0 <= y <= 25 and shadow(x, y):
                    dots += f'<circle cx="{x:g}" cy="{y:g}" r=".95"/>'
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 25 25">'
           f'<path fill="{PAPER}" fill-rule="evenodd" d="M0 0H15V15H0ZM2 2V13H13V2Z"/>'
           f'<g fill="{PAPER}">{dots}</g></svg>\n')
    with open(os.path.join(SHIPPED, 'tone-frame.svg'), 'w') as f:
        f.write(svg)


# SFX ---------------------------------------------------------------------
def sfx():
    out = {}
    # ドキッ: a jolt of the heart, in spot red
    d, b = letters('dela', 'ドキッ', 100, 0, 100, -6,
                   [(0, 0, -10, 1.0), (0, -18, 7, 0.92), (4, -26, 14, 0.62)], skew=8)
    save('sfx-doki.svg', inked('t', d, SPOT, [(PAPER, 22), (INK, 11)]), box(b, 14))
    out['doki'] = (d, b)
    # ゴゴゴ: menacing aura, three letters stepping down in tone
    d, b = letters('dela', 'ゴゴゴ', 80, 0, 80, -4,
                   [(0, 0, -8, 0.8), (0, 40, -4, 0.92), (0, 86, 2, 1.06)], skew=10)
    save('sfx-gogogo.svg',
         f'<defs>{TONE_PATTERN}</defs>' + inked('t', d, 'url(#tn)', [(INK, 16), (PAPER, 7)]), box(b, 12))
    # キラキラ: sparkle, with sparkles
    d, b = letters('dela', 'キラキラ', 64, 0, 64, -4,
                   [(0, 6, -8, 1), (0, -4, 4, 0.9), (0, 2, -6, 1), (0, -6, 8, 0.9)], skew=6)
    sp = (f'<path d="{sparkle_path(b[2] + 4, b[1] - 2, 16)}" fill="{PAPER}"/>'
          f'<path d="{sparkle_path(b[0] - 6, b[3] - 4, 10)}" fill="{PAPER}"/>'
          f'<path d="{sparkle_path((b[0] + b[2]) / 2 + 30, b[3] + 10, 8)}" fill="{SPOT}"/>')
    bb = (b[0] - 18, b[1] - 20, b[2] + 22, b[3] + 20)
    save('sfx-kirakira.svg', inked('t', d, PAPER, [(INK, 10)]) + sp, box(bb, 4))
    # ドン: dramatic impact, on a burst
    d, b = letters('dela', 'ドン', 110, 0, 110, -8, [(0, 0, -6, 1), (0, 10, 8, 1.06)], skew=10)
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    R = max(b[2] - b[0], b[3] - b[1]) * 0.78
    burst = burst_path(cx, cy, R, R * 0.66, 18, 3, 0.28)
    bb = (cx - R, cy - R, cx + R, cy + R)
    save('sfx-don.svg',
         f'<path d="{burst}" fill="{PAPER}" stroke="#000" stroke-width="4" stroke-linejoin="round"/>'
         + inked('t', d, SPOT, [(INK, 12)]), box(bb, 4))
    # ジー: staring, the long mark drawn out
    d, b = letters('dela', 'ジー', 90, 0, 90, -10, [(0, 0, -4, 1), (0, 0, 0, 1)], skew=8, sx=[1, 1.9])
    lines = speed_lines(b[0] - 10, b[2] + 10, b[3] + 8, b[3] + 26, 12, 9, 2.4)
    save('sfx-jii.svg', inked('t', d, PAPER, [(INK, 10)]) + f'<path d="{lines}" fill="{PAPER}"/>',
         box((b[0] - 10, b[1], b[2] + 10, b[3] + 28), 6))
    # ニヤ, フン, ぷい, チュッ: small asides
    d, b = letters('dela', 'ニヤ', 80, 0, 80, -4, [(0, 0, -12, 0.9), (0, -10, 6, 1.05)], skew=12)
    save('sfx-niya.svg', inked('t', d, PAPER, [(INK, 10)]), box(b, 8))
    d, b = letters('dela', 'フン', 80, 0, 80, -6, [(0, 0, -6, 1), (0, 6, 10, 0.9)], skew=6)
    puff = ''.join(f'<circle cx="{r(b[2] + 14 + i * 10)}" cy="{r(b[1] + 18 - i * 6)}" r="{r(7 - i * 2)}" fill="none" stroke="{PAPER}" stroke-width="3"/>' for i in range(3))
    save('sfx-fun.svg', inked('t', d, PAPER, [(INK, 10)]) + puff, box((b[0], b[1] - 6, b[2] + 40, b[3]), 8))
    d, b = letters('dela', 'ぷい', 80, 0, 80, -2, [(0, 0, -14, 1), (0, 8, -4, 0.9)], skew=4)
    save('sfx-pui.svg', inked('t', d, PAPER, [(INK, 10)]), box(b, 8))
    d, b = letters('dela', 'チュッ', 80, 0, 80, -6, [(0, 0, -8, 1), (0, -6, 4, 0.8), (2, -14, 12, 0.6)], skew=8)
    hb = f'<g transform="translate({r(b[2] + 2)} {r(b[1] - 18)}) scale(.3)"><path d="{HEART}" fill="{SPOT}" stroke="{PAPER}" stroke-width="9"/></g>'
    save('sfx-chu.svg', inked('t', d, SPOT, [(PAPER, 16), (INK, 8)]) + hb,
         box((b[0], b[1] - 18, b[2] + 32, b[3]), 10))
    # ドキドキ: a pounding heart, for audio covers
    d, b = letters('dela', 'ドキドキ', 70, 0, 70, -4,
                   [(0, 0, -8, 1), (0, -8, 6, 0.9), (0, 4, -6, 1.05), (0, -6, 8, 0.92)], skew=6)
    save('sfx-dokidoki.svg', inked('t', d, PAPER, [(INK, 10)]), box(b, 8))
    # 漫画, for the wordmark
    d, b = letters('dela', '漫画', 100, 0, 100, 0)
    save('sfx-manga.svg', f'<path d="{d}" fill="{PAPER}"/>', box(b, 2))
    return out


if __name__ == '__main__':
    os.makedirs(PAGE, exist_ok=True)
    glyphs()
    motifs()
    tone_frame()
    sfx()
    print('icons written to', SHIPPED, 'and', PAGE)
