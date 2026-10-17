# Motif and glyph generator for Ukiyo. Flat colour inside sumi keylines, as a
# woodblock prints it. The outlines of 恋, 浮 and 世 come from Yuji Syuku by
# Kinuta Font Factory (SIL OFL 1.1, kanji-OFL.txt), in font units in
# kanji.json, so the seals need no font. wave.svg, sakura.svg and sensu.svg
# appear on the design-system page only (design-system/ds/prints).
#   python3 motifs.py ../src/icons
import json, math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from geom import chain, resample, tangents, offset, poly, rot, fmt

OUT = sys.argv[1]
K = json.load(open(os.path.join(os.path.dirname(__file__), 'kanji.json')))

SUMI = '#15110f'
BERO = '#1f4f8f'      # Prussian blue, mid
BERO_DK = '#12305e'
BERO_LT = '#7fb0dc'
AI_PALE = '#bcd6ea'
FOAM = '#f4eddc'
SHU = '#d0462a'       # vermilion as a motif prints it
SHU_DK = '#a8321c'
SAKURA = '#f6bcc8'
SAKURA_LT = '#fde3e8'
BENI = '#d8587a'
KINARI = '#efe4cc'
KI = '#c99a3e'        # ochre
MICA = '#e6d6a6'

def save(name, body, vb='0 0 100 100'):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>'
    open(os.path.join(OUT, name), 'w').write(svg)

def kanji(ch, x, y, size):
    """Place a glyph so its em box (1000 units, ascent 1160) fills size at x, y."""
    g = K[ch]; s = size / 1000
    # em box top = asc - 880 (ascender of the ideographic box) in flipped units
    top = g['asc'] - 880
    return f'<path transform="translate({fmt(x)} {fmt(y)}) scale({s:.5f}) translate(0 {-top})" d="{g["d"]}"/>'

# ---------------------------------------------------------------- wave crest
def claw(p, t, L, w, lean=0.55):
    """A clawed foam finger at p: rises along the outward normal, then hooks
    forward along the tangent like a talon, with a small spur on its inside."""
    n = (t[1], -t[0])
    at = lambda a, b: (p[0] + n[0] * a + t[0] * b, p[1] + n[1] * a + t[1] * b)
    return [at(0, -1.4 * w), at(0.45 * L, -1.35 * w), at(0.8 * L, -1.0 * w), at(1.0 * L, -0.3 * w),
            at(1.06 * L, 0.5 * w), at(0.98 * L, 1.35 * w), at(0.8 * L, 2.1 * w),
            at(0.78 * L, 1.35 * w), at(0.66 * L, 0.75 * w), at(0.56 * L, 1.45 * w),
            at(0.42 * L, 1.55 * w), at(0.4 * L, 0.95 * w), at(0, 1.3 * w)]

def wave(name, stroke=2.4, droplets=True, bands=True, light=False):
    back = [((4, 74), (16, 34), (50, 19)),
            ((76, 8), (104, 12), (114, 32))]
    lip = [((119, 44), (113, 58), (101, 60)),
           ((91, 62), (84, 54), (88, 45)),
           ((91, 39), (98, 38), (101, 43))]
    under = [((93, 31), (73, 31), (64, 44))]
    face = [((55, 58), (64, 92), (118, 114))]
    start = (6, 114)
    outline = chain(start, back + lip + under + face, 40) + [start]
    body = poly(outline)
    crest = resample(chain((50, 19), [back[1], lip[0]], 80), 0.5)
    T = tangents(crest)
    # the foam band tapers in from the back of the wave
    full = offset(crest, -7.5)
    m = len(crest)
    inner = []
    for j, (p0, p1) in enumerate(zip(crest, full)):
        k = min(1.0, j / (m * 0.16)); k = k * k * (3 - 2 * k)
        inner.append((p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k))
    pts = []; n = len(crest)
    marks = [0.33, 0.47, 0.6, 0.72, 0.84]
    taken = set()
    for f in marks:
        taken.add(int(n * f))
    i = 0
    while i < n:
        p, t = crest[i], T[i]
        if i in taken:
            f = i / n
            k = min(1, (f - 0.28) * 2.6)
            pts += claw(p, t, 6 + 5 * k, 2.2 + 0.8 * k)
            i += 14
            continue
        pts.append(p); i += 1
    foam = poly(pts + inner[::-1])
    bk = chain(start, back, 60)
    band = ''
    if bands:
        band = ''.join(f'<path d="{poly(offset(bk, -d)[10:-26], close=False)}" fill="none" stroke="{BERO_LT}" stroke-width="{w_}" stroke-linecap="round"/>'
                       for d, w_ in (((14, 2.4), (21, 2), (28, 1.6)) if not light else ((15, 3.4), (25, 2.8))))
    drops = ''
    if droplets:
        for (x, y, r) in ((117, 18, 2.4), (110, 9, 1.8), (121, 28, 1.5), (100, 5, 1.3)):
            drops += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{FOAM}" stroke="{SUMI}" stroke-width="1.1"/>'
    save(name, f'''<defs><clipPath id="b"><path d="{body}"/></clipPath>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{'#3c7cc6' if light else BERO}"/><stop offset="1" stop-color="{'#1f4f8f' if light else BERO_DK}"/></linearGradient></defs>
<path d="{body}" fill="url(#g)"/>
<g clip-path="url(#b)">{band}</g>
<path d="{body}" fill="none" stroke="{SUMI}" stroke-width="{stroke}" stroke-linejoin="round"/>
<path d="{foam}" fill="{FOAM}" stroke="{SUMI}" stroke-width="{stroke * 0.65}" stroke-linejoin="round"/>
{drops}''', '0 0 134 122')

# ---------------------------------------------------------------- sakura
def petal_path(cx, cy, a, r, w=1.0):
    # one notched petal pointing up, scaled to r, rotated a around the centre;
    # narrow enough at the base that five of them meet without overlapping
    q = lambda p: rot((cx + p[0] * r * w, cy + p[1] * r), a, (cx, cy))
    f = lambda pt: f'{fmt(pt[0])} {fmt(pt[1])}'
    return (f'M{f(q((0, -0.06)))} '
            f'C{f(q((-0.1, -0.16)))} {f(q((-0.4, -0.42)))} {f(q((-0.45, -0.68)))} '
            f'C{f(q((-0.49, -0.88)))} {f(q((-0.38, -1.0)))} {f(q((-0.22, -1.0)))} '
            f'C{f(q((-0.1, -1.0)))} {f(q((-0.03, -0.96)))} {f(q((0, -0.915)))} '
            f'C{f(q((0.03, -0.96)))} {f(q((0.1, -1.0)))} {f(q((0.22, -1.0)))} '
            f'C{f(q((0.38, -1.0)))} {f(q((0.49, -0.88)))} {f(q((0.45, -0.68)))} '
            f'C{f(q((0.4, -0.42)))} {f(q((0.1, -0.16)))} {f(q((0, -0.06)))}Z')

PETAL = [((-0.1, -0.16), (-0.4, -0.42), (-0.45, -0.68)),
         ((-0.49, -0.88), (-0.38, -1.0), (-0.22, -1.0)),
         ((-0.1, -1.0), (-0.03, -0.96), (0, -0.915)),
         ((0.03, -0.96), (0.1, -1.0), (0.22, -1.0)),
         ((0.38, -1.0), (0.49, -0.88), (0.45, -0.68)),
         ((0.4, -0.42), (0.1, -0.16), (0, -0.06))]

def blossom_outline(cx, cy, r, core=0.36, bins=720):
    """The silhouette of five petals around a core: for every angle, the
    furthest petal edge, never closer than the core. One closed keyline."""
    pts = chain((0, -0.06), PETAL, 30)
    best = [core * r] * bins
    for k in range(5):
        a = math.radians(k * 72)
        for px, py in pts:
            x, y = rot((px * r, py * r), a)
            th = (math.degrees(math.atan2(x, -y)) % 360)
            i = int(th / 360 * bins) % bins
            best[i] = max(best[i], math.hypot(x, y))
    # fill empty bins from neighbours, then smooth lightly
    for _ in range(3):
        best = [max(best[i], min(best[i - 1], best[(i + 1) % bins])) for i in range(bins)]
    out = []
    for i, rr in enumerate(best):
        th = math.radians(i * 360 / bins)
        out.append((cx + math.sin(th) * rr, cy - math.cos(th) * rr))
    return poly(out)

def sakura(name, mode='colour'):
    cx = cy = 50; r = 46
    petals = ''.join(f'<path d="{petal_path(cx, cy + 2, math.radians(i * 72), r)}"/>' for i in range(5))
    if mode == 'line':
        # keyline only: the blossom's silhouette as one line. Drawn as a path,
        # not an SVG mask, since WebKit rasterises those coarsely
        save(name, f'<path d="{blossom_outline(cx, cy + 2, r - 3)}" fill="none" stroke="#000" stroke-width="5.5" stroke-linejoin="round"/>'
                   f'<circle cx="{cx}" cy="{cy + 2}" r="5"/>')
        return
    if mode == 'mask':
        save(name, f'<g fill="#000">{petals}</g>')
        return
    stamens = ''
    for i in range(10):
        a = math.radians(i * 36 + 18)
        L = 13 if i % 2 else 10
        x2, y2 = cx + math.sin(a) * L, cy + 2 - math.cos(a) * L
        stamens += f'<line x1="{cx}" y1="{cy + 2}" x2="{fmt(x2)}" y2="{fmt(y2)}"/><circle cx="{fmt(x2)}" cy="{fmt(y2)}" r="2.1" fill="{KI}" stroke="none"/>'
    save(name, f'''<defs><radialGradient id="s" cx="50" cy="52" r="46" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="{BENI}"/><stop offset=".34" stop-color="{SAKURA}"/><stop offset="1" stop-color="{SAKURA_LT}"/></radialGradient></defs>
<g fill="url(#s)" stroke="{SUMI}" stroke-width="4" stroke-linejoin="round">{petals}</g>
<g stroke="{SHU_DK}" stroke-width="1.6" stroke-linecap="round">{stamens}</g>
<circle cx="{cx}" cy="{cy + 2}" r="4.2" fill="{SHU}"/>''')

def petal(name):
    # a single falling petal: a long teardrop with a small notch, so it never
    # reads as a heart
    d = 'M50 97 C31 82 25 46 36 14 Q42 5 50 13 Q58 5 64 14 C75 46 69 82 50 97Z'
    save(name, f'<defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="{BENI}"/><stop offset=".45" stop-color="{SAKURA}"/><stop offset="1" stop-color="{SAKURA_LT}"/></linearGradient></defs>'
               f'<path d="{d}" fill="url(#g)" stroke="{SUMI}" stroke-width="4" stroke-linejoin="round"/>')

# ---------------------------------------------------------------- seals
def chipped_rect(x, y, w, h, r, seed, jit=0.9, step=2.0):
    """A rounded rectangle whose edge is nicked like a carved stone seal."""
    rnd = random.Random(seed)
    pts = []
    def arc(cx, cy, a0, a1):
        n = 6
        for i in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    def edge(x0, y0, x1, y1):
        L = math.dist((x0, y0), (x1, y1)); n = max(2, int(L / step))
        nx, ny = (y1 - y0) / L, -(x1 - x0) / L
        for i in range(1, n):
            k = i / n; j = (rnd.random() - 0.5) * jit
            if rnd.random() < 0.05: j -= jit * 1.6
            pts.append((x0 + (x1 - x0) * k + nx * j, y0 + (y1 - y0) * k + ny * j))
    arc(x + r, y + r, 180, 270); edge(x + r, y, x + w - r, y)
    arc(x + w - r, y + r, 270, 360); edge(x + w, y + r, x + w, y + h - r)
    arc(x + w - r, y + h - r, 0, 90); edge(x + w - r, y + h, x + r, y + h)
    arc(x + r, y + h - r, 90, 180); edge(x, y + h - r, x, y + r)
    return poly(pts)

def specks(seed, n, box, rmax=1.4):
    rnd = random.Random(seed); x0, y0, x1, y1 = box; out = ''
    for _ in range(n):
        out += f'<circle cx="{fmt(rnd.uniform(x0, x1))}" cy="{fmt(rnd.uniform(y0, y1))}" r="{fmt(rnd.uniform(0.4, rmax))}"/>'
    return out

def hanko(name, mode='colour'):
    outer = chipped_rect(4, 4, 92, 92, 9, 11)
    frame = chipped_rect(11, 11, 78, 78, 4, 12, 0.6)
    glyph = kanji('恋', 18, 17, 64)
    if mode == 'line':
        # unstamped: the frame and the character only, for a single-colour mask
        save(name, f'<path d="{chipped_rect(6, 6, 88, 88, 8, 11)}" fill="none" stroke="#000" stroke-width="6"/>'
                   f'<g fill="#000">{glyph}</g>')
        return
    # white characters on red (hakubun): the paper shows through the cut, so
    # it is printed here as kinari over the red, with no SVG mask
    save(name, f'''<defs><radialGradient id="i" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#e2553a"/><stop offset=".7" stop-color="{SHU}"/><stop offset="1" stop-color="#b93a20"/></radialGradient></defs>
<path d="{outer}" fill="url(#i)"/>
<path d="{frame}" fill="none" stroke="{KINARI}" stroke-width="3"/>
<g fill="{KINARI}">{glyph}{specks(3, 26, (6, 6, 94, 94))}</g>''')

def seal_ukiyo(name):
    # the wordmark seal: 浮世 stacked, white on vermilion
    outer = chipped_rect(3, 3, 54, 104, 6, 21)
    frame = chipped_rect(8, 8, 44, 94, 2, 22, 0.5)
    save(name, f'''<path d="{outer}" fill="{SHU}"/>
<path d="{frame}" fill="none" stroke="{KINARI}" stroke-width="2.4"/>
<g fill="{KINARI}">{kanji('浮', 10, 11, 40)}{kanji('世', 10, 56, 40)}{specks(5, 18, (4, 4, 56, 106), 1.1)}</g>''', '0 0 60 110')

# ---------------------------------------------------------------- lantern
def lantern(name):
    body = 'M25 20 C3 28 3 86 25 94 L55 94 C77 86 77 28 55 20 Z'
    ribs = ''.join(f'<path d="M4 {y} Q40 {y + 5 if y > 57 else y - 5 + (y - 20) * 0} 76 {y}" />' for y in range(26, 94, 7))
    ribs = ''
    for y in range(27, 92, 7):
        bow = (y - 57) * 0.16
        ribs += f'<path d="M2 {y} Q40 {fmt(y + bow)} 78 {y}"/>'
    save(name, f'''<defs><clipPath id="c"><path d="{body}"/></clipPath>
<radialGradient id="g" cx="40" cy="55" r="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd59a"/><stop offset=".3" stop-color="#f58a52"/><stop offset=".72" stop-color="{SHU}"/><stop offset="1" stop-color="{SHU_DK}"/></radialGradient></defs>
<path d="M40 2 V11" stroke="{SUMI}" stroke-width="2.4"/><circle cx="40" cy="5" r="3.4" fill="none" stroke="{SUMI}" stroke-width="2"/>
<path d="{body}" fill="url(#g)"/>
<g clip-path="url(#c)" fill="none" stroke="{SHU_DK}" stroke-width="1.4" opacity=".75">{ribs}</g>
<path d="M40 22 V92" stroke="#fff3d8" stroke-width="5" opacity=".18"/>
<path d="{body}" fill="none" stroke="{SUMI}" stroke-width="2.6" stroke-linejoin="round"/>
<rect x="22" y="12" width="36" height="10" rx="1.5" fill="{SUMI}"/><rect x="22" y="15.5" width="36" height="1.6" fill="{KI}"/>
<rect x="22" y="92" width="36" height="9" rx="1.5" fill="{SUMI}"/><rect x="22" y="95.5" width="36" height="1.6" fill="{KI}"/>
<path d="M40 101 V112" stroke="{SUMI}" stroke-width="2"/><path d="M36 106 L40 116 L44 106 Z" fill="{SHU_DK}" stroke="{SUMI}" stroke-width="1.2"/>''', '0 0 80 118')

# ---------------------------------------------------------------- folding fan
def sensu(name):
    cx, cy = 60, 76; r0, r1 = 28, 68; a0, a1 = 18, 162; N = 12
    pt = lambda R, a: (cx + R * math.cos(math.radians(a)), cy - R * math.sin(math.radians(a)))
    f = lambda p: f'{fmt(p[0])} {fmt(p[1])}'
    pleats = ''
    for i in range(N):
        aa = a0 + (a1 - a0) * i / N; bb = a0 + (a1 - a0) * (i + 1) / N
        col = SHU if i % 2 == 0 else '#bb3c22'
        pleats += f'<path d="M{f(pt(r0, aa))} L{f(pt(r1, aa))} A{r1} {r1} 0 0 0 {f(pt(r1, bb))} L{f(pt(r0, bb))} A{r0} {r0} 0 0 1 {f(pt(r0, aa))}Z" fill="{col}"/>'
    leaf = f'M{f(pt(r0, a0))} L{f(pt(r1, a0))} A{r1} {r1} 0 0 0 {f(pt(r1, a1))} L{f(pt(r0, a1))} A{r0} {r0} 0 0 1 {f(pt(r0, a0))}Z'
    edge = f'<path d="M{f(pt(r1 - 4, a0))} A{r1 - 4} {r1 - 4} 0 0 0 {f(pt(r1 - 4, a1))}" fill="none" stroke="{KI}" stroke-width="3"/>'
    moon_c = pt(48, 118)
    ribs = ''.join(f'<path d="M{f(pt(5, a0 + (a1 - a0) * i / N))} L{f(pt(r0, a0 + (a1 - a0) * i / N))}"/>' for i in range(1, N))
    save(name, f'''<defs><clipPath id="c"><path d="{leaf}"/></clipPath></defs>
<g stroke="#9c6a34" stroke-width="2.2" stroke-linecap="round">{ribs}</g>
<path d="M{f(pt(4, a0))} L{f(pt(r1 + 1, a0))}" stroke="{SUMI}" stroke-width="5" stroke-linecap="round"/>
<path d="M{f(pt(4, a1))} L{f(pt(r1 + 1, a1))}" stroke="{SUMI}" stroke-width="5" stroke-linecap="round"/>
{pleats}
<g clip-path="url(#c)"><circle cx="{fmt(moon_c[0])}" cy="{fmt(moon_c[1])}" r="12" fill="{KINARI}"/>
{edge}</g>
<path d="{leaf}" fill="none" stroke="{SUMI}" stroke-width="2.6" stroke-linejoin="round"/>
<circle cx="{cx}" cy="{cy}" r="4.6" fill="{SUMI}"/><circle cx="{cx}" cy="{cy}" r="1.8" fill="{KI}"/>''', '0 0 120 84')

# ---------------------------------------------------------------- moon
def moon(name, cloud=True):
    # a full moon of mica-dusted paper with two bands of mist across it
    # mist bands (kasumi) printed as bokashi: solid in the middle, fading out
    band = lambda x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="url(#k)"/>'
    c = band(0, 58, 74, 9) + band(30, 71, 70, 8) + band(10, 83, 52, 6) if cloud else ''
    save(name, f'''<defs><linearGradient id="k"><stop offset="0" stop-color="#2b5c9c" stop-opacity="0"/><stop offset=".22" stop-color="#2b5c9c"/><stop offset=".8" stop-color="#24508c"/><stop offset="1" stop-color="#24508c" stop-opacity="0"/></linearGradient><radialGradient id="g" cx=".44" cy=".4" r=".62"><stop offset="0" stop-color="#fffaf0"/><stop offset=".65" stop-color="#f1e6c8"/><stop offset="1" stop-color="#d9c48f"/></radialGradient></defs>
<circle cx="50" cy="46" r="40" fill="url(#g)"/>
<circle cx="50" cy="46" r="40" fill="none" stroke="{SUMI}" stroke-width="2" opacity=".55"/>{c}''')

wave('wave.svg')
wave('glyph-wave.svg', stroke=3.6, droplets=False, light=True)
sakura('sakura.svg')
sakura('glyph-sakura.svg')
sakura('glyph-sakura-line.svg', 'line')
petal('petal.svg')
hanko('hanko.svg')
hanko('glyph-hanko-line.svg', 'line')
seal_ukiyo('seal-ukiyo.svg')
lantern('lantern.svg')
sensu('sensu.svg')
moon('moon.svg')
print('ok')
