"""City Pop motifs, glyph masks and the caustic tile.

usage: python3 -I plugins/citypop/tools/icons.py   (needs Pillow)

Writes the SVGs and the seamless caustic tile (three densities, lossless WebP)
the plugin ships into src/icons/, and the motifs only the design-system page
shows (palms, sunglasses, headphones, the cocktail and the whole cassette)
into design-system/ds/motifs/. Deterministic: the same run gives the same
files.
"""
import math, os, random, re

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(HERE, '..', 'src', 'icons')
MOTIFS = os.path.join(HERE, '..', 'design-system', 'ds', 'motifs')
os.makedirs(ICONS, exist_ok=True)
os.makedirs(MOTIFS, exist_ok=True)

NS = 'xmlns="http://www.w3.org/2000/svg"'

# The late-Showa dusk
GOLD, APRICOT, CORAL, PINK, MAGENTA = '#ffe08a', '#ffb36b', '#ff7a6b', '#f5508a', '#c23a8e'
VIOLET, LILAC, NIGHT, NAVY = '#6a3fb0', '#b9a6f0', '#0c0e30', '#171642'
POOL, POOL_DEEP, SHADOW = '#4fe3da', '#1596b0', '#120a33'


def f(x):
    return f'{x:.2f}'.rstrip('0').rstrip('.')


def save(name, body, folder=ICONS):
    with open(os.path.join(folder, name), 'w') as fh:
        fh.write(body.strip() + '\n')


def sunset_stops():
    return (f'<stop offset="0" stop-color="{GOLD}"/><stop offset=".28" stop-color="{APRICOT}"/>'
            f'<stop offset=".55" stop-color="{CORAL}"/><stop offset=".8" stop-color="{PINK}"/>'
            f'<stop offset="1" stop-color="{MAGENTA}"/>')


def glint(cx, cy, ry, rx=None, w=0.16):
    """The four-point sparkle of an 80s anime cel: concave arms, long vertical."""
    rx = rx or ry * 0.78
    a, b = rx * w, ry * w
    return (f'M{f(cx)} {f(cy - ry)}Q{f(cx + a)} {f(cy - b)} {f(cx + rx)} {f(cy)}'
            f'Q{f(cx + a)} {f(cy + b)} {f(cx)} {f(cy + ry)}Q{f(cx - a)} {f(cy + b)} {f(cx - rx)} {f(cy)}'
            f'Q{f(cx - a)} {f(cy - b)} {f(cx)} {f(cy - ry)}Z')


def glint_group(cx, cy, r, op=1, cls=''):
    attr = f' class="{cls}"' if cls else ''
    return (f'<g{attr} opacity="{op}"><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.34)}" fill="#fff" opacity=".45"/>'
            f'<path d="{glint(cx, cy, r)}" fill="#fff"/></g>')


def sun_gaps(cy, r, bands):
    """Horizontal cuts through the lower half of a sun: (offset from centre, height) in radii."""
    return ''.join(
        f'<rect x="{f(-r * 2)}" y="{f(cy + r * o)}" width="{f(r * 6)}" height="{f(r * h)}" fill="#000"/>'
        for o, h in bands)


SUN_BANDS = [(0.06, 0.035), (0.24, 0.055), (0.42, 0.075), (0.6, 0.095), (0.79, 0.115)]

# ---------------------------------------------------------------- glyphs
save('glint.svg', f'<svg {NS} viewBox="0 0 40 40"><defs><radialGradient id="c"><stop offset="0" stop-color="#fff"/>'
     f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
     f'<circle cx="20" cy="20" r="9" fill="url(#c)"/><path d="{glint(20, 20, 19.5, 15, 0.13)}" fill="#fff"/></svg>')

# Rating: a striped sun; empty is the same sun drawn as an outline
g_bands = [(0.12, 0.09), (0.38, 0.12), (0.64, 0.15)]
save('glyph-sun.svg', f'<svg {NS} viewBox="0 0 24 24"><mask id="m"><rect width="24" height="24" fill="#fff"/>'
     f'{sun_gaps(12, 10.6, g_bands)}</mask><circle cx="12" cy="12" r="10.6" mask="url(#m)"/></svg>')
save('glyph-sun-line.svg', f'<svg {NS} viewBox="0 0 24 24"><mask id="m"><rect width="24" height="24" fill="#fff"/>'
     f'{sun_gaps(12, 10.6, g_bands)}</mask><clipPath id="c"><circle cx="12" cy="12" r="10"/></clipPath>'
     f'<circle cx="12" cy="12" r="9.75" fill="none" stroke="#000" stroke-width="1.7" mask="url(#m)"/>'
     f'<g clip-path="url(#c)" stroke="#000" stroke-width="1.2"><path d="M0 15.15H24M0 18.05H24M0 21.3H24"/></g></svg>')

HEART = 'M12 21.2C6.4 17.4 2.6 13.9 2.6 9.5C2.6 6.4 5 4 8 4C9.8 4 11.2 4.9 12 6.3C12.8 4.9 14.2 4 16 4C19 4 21.4 6.4 21.4 9.5C21.4 13.9 17.6 17.4 12 21.2Z'
save('glyph-heart.svg', f'<svg {NS} viewBox="0 0 24 24"><path d="{HEART}"/></svg>')
save('glyph-heart-line.svg', f'<svg {NS} viewBox="0 0 24 24"><path d="{HEART}" fill="none" stroke="#000" stroke-width="1.9" stroke-linejoin="round"/></svg>')

# O counter: a drop falling into a pool ripple
DROP = 'M12 1.2C12 1.2 7.2 7.1 7.2 10.1A4.8 4.8 0 0 0 16.8 10.1C16.8 7.1 12 1.2 12 1.2Z'
save('glyph-splash.svg', f'<svg {NS} viewBox="0 0 24 24"><path d="{DROP}"/>'
     '<ellipse cx="12" cy="19.6" rx="10.3" ry="3.1" fill="none" stroke="#000" stroke-width="1.5"/>'
     '<ellipse cx="12" cy="19.6" rx="4.6" ry="1.25"/>'
     '<circle cx="4.6" cy="14.4" r="1.1"/><circle cx="19.4" cy="14.1" r="1.1"/></svg>')

# O counter in SFW mode: a cocktail
save('glyph-cocktail.svg', f'<svg {NS} viewBox="0 0 24 24"><path d="M2.6 3.4H21.4L12.9 12.6V19.4L16.6 20.6V22H7.4V20.6L11.1 19.4V12.6Z"/>'
     '<path d="M15.6 1.2 19.6 1.9 13.9 8.6 13 7.9Z"/><circle cx="14.6" cy="6.1" r="2.1" fill="#fff"/>'
     '<circle cx="14.6" cy="6.1" r="1.6"/></svg>')

save('chevron.svg', f'<svg {NS} viewBox="0 0 12 12"><path d="M2 4.2 6 8.2 10 4.2" fill="none" stroke="{LILAC}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# ---------------------------------------------------------------- striped sun
save('sun.svg', f'''<svg {NS} viewBox="0 0 120 120">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">{sunset_stops()}</linearGradient>
<radialGradient id="h"><stop offset=".7" stop-color="{CORAL}" stop-opacity=".32"/><stop offset="1" stop-color="{PINK}" stop-opacity="0"/></radialGradient>
<mask id="m"><rect width="120" height="120" fill="#fff"/>{sun_gaps(60, 46, SUN_BANDS)}</mask></defs>
<circle cx="60" cy="60" r="59" fill="url(#h)"/>
<circle cx="60" cy="60" r="46" fill="url(#s)" mask="url(#m)"/>
<path d="M30 36A36 36 0 0 1 60 18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
</svg>''')


save('sun-horizon.svg', open(os.path.join(ICONS, 'sun.svg')).read().replace('viewBox="0 0 120 120"', 'viewBox="0 0 120 96"'))

# ---------------------------------------------------------------- palms
def frond(x, y, ang, length, droop, width, n=8, lift=0.18):
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    p0 = (x, y)
    p1 = (x + dx * length * 0.5, y + dy * length * 0.5 - length * lift)
    p2 = (x + dx * length, y + dy * length + droop)
    steps = n * 2
    up, lo = [], []
    for i in range(steps + 1):
        t = i / steps
        bx = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        by = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        tx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
        ty = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
        m = math.hypot(tx, ty) or 1
        tx, ty = tx / m, ty / m
        nx, ny = -ty, tx
        if ny > 0:
            nx, ny = -nx, -ny
        w = width * math.sin(math.pi * min(1, t * 1.08)) ** 0.75 * (1 - 0.35 * t)
        tip = i % 2 == 0
        back = w * 0.9 if tip else 0
        up.append((bx + nx * w * (0.5 if tip else 0.12) - tx * back * 0.6, by + ny * w * (0.5 if tip else 0.12) - ty * back * 0.6 + (w * 0.25 if tip else 0)))
        lo.append((bx - nx * w * (0.2 if tip else 0.2) - tx * back, by - ny * w * (0.2 if tip else 0.2) - ty * back + (w * 1.15 if tip else 0)))
    pts = up + lo[::-1]
    return 'M' + 'L'.join(f'{f(px)} {f(py)}' for px, py in pts) + 'Z'


def trunk(bx, by, cx, cy, bend, w0, w1, n=16):
    mx, my = (bx + cx) / 2 + bend, (by + cy) / 2
    left, right, rings = [], [], []
    for i in range(n + 1):
        t = i / n
        px = (1 - t) ** 2 * bx + 2 * (1 - t) * t * mx + t * t * cx
        py = (1 - t) ** 2 * by + 2 * (1 - t) * t * my + t * t * cy
        tx = 2 * (1 - t) * (mx - bx) + 2 * t * (cx - mx)
        ty = 2 * (1 - t) * (my - by) + 2 * t * (cy - my)
        m = math.hypot(tx, ty) or 1
        nx, ny = -ty / m, tx / m
        w = w0 + (w1 - w0) * t
        left.append((px + nx * w, py + ny * w))
        right.append((px - nx * w, py - ny * w))
        if 0 < i < n:
            rings.append(f'M{f(px + nx * w)} {f(py + ny * w)}Q{f(px + ty / m * w * 0.5)} {f(py - tx / m * w * 0.5 + 1.2)} {f(px - nx * w)} {f(py - ny * w)}')
    body = 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in left + right[::-1]) + 'Z'
    return body, ''.join(rings)


def palm(bx, by, cx, cy, bend, scale, flip=1):
    tb, rings = trunk(bx, by, cx, cy, bend, 4.6 * scale, 2.4 * scale)
    fr = []
    for ang, ln, dr, wd in [(-170, 46, 18, 7), (-140, 40, 6, 6.5), (-105, 30, -2, 5.5), (-62, 36, 2, 6),
                            (-25, 46, 12, 7), (10, 42, 24, 6.5), (160, 40, 26, 6.5), (40, 30, 26, 5)]:
        a = ang if flip == 1 else 180 - ang
        fr.append(frond(cx, cy, a, ln * scale, dr * scale, wd * scale))
    return tb, rings, fr


def palm_svg(colour):
    tb, rings, fr = palm(70, 118, 58, 34, 18, 1.0)
    tb2, rings2, fr2 = palm(40, 118, 34, 58, -10, 0.7, flip=-1)
    sh = 'transform="translate(2.4 3.2)"'
    if colour:
        defs = (f'<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffc9a0"/>'
                f'<stop offset=".45" stop-color="#c9839a"/><stop offset="1" stop-color="#4b2f78"/></linearGradient>'
                f'<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ff0c8"/>'
                f'<stop offset=".5" stop-color="#18a39a"/><stop offset="1" stop-color="#0e5472"/></linearGradient>'
                f'<linearGradient id="l2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ccfb3"/>'
                f'<stop offset="1" stop-color="#0b3e60"/></linearGradient></defs>')
        out = defs
        for t_, r_, fr_, lf in [(tb2, rings2, fr2, 'url(#l2)'), (tb, rings, fr, 'url(#l)')]:
            out += f'<path d="{t_}" fill="{SHADOW}" opacity=".45" {sh}/>'
            out += f'<path d="{t_}" fill="url(#t)"/><path d="{r_}" fill="none" stroke="#3a2264" stroke-width="1" opacity=".55"/>'
            out += ''.join(f'<path d="{p}" fill="{SHADOW}" opacity=".45" {sh}/>' for p in fr_)
            out += ''.join(f'<path d="{p}" fill="{lf}"/>' for p in fr_)
        out += '<circle cx="56" cy="38" r="3.2" fill="#6a3a2a"/><circle cx="61" cy="39" r="3" fill="#7b4632"/>'
        return f'<svg {NS} viewBox="0 0 120 120">{out}</svg>'
    paths = ''.join(f'<path d="{p}"/>' for p in [tb2] + fr2 + [tb] + fr)
    return f'<svg {NS} viewBox="0 0 120 120"><g fill="#000">{paths}</g></svg>'


save('palm.svg', palm_svg(True), MOTIFS)


def palms_backdrop():
    """Silhouettes for the fixed page backdrop, bottom-left corner."""
    out = []
    for bx, by, cx, cy, bend, sc, fl in [(70, 400, 120, 120, -40, 2.6, 1), (170, 400, 230, 190, -20, 2.0, 1),
                                         (20, 400, 10, 210, 30, 1.7, -1)]:
        tb, _, fr = palm(bx, by, cx, cy, bend, sc, fl)
        out += [tb] + fr
    paths = ''.join(f'<path d="{p}"/>' for p in out)
    return f'<svg {NS} viewBox="0 0 360 400" preserveAspectRatio="xMinYMax meet"><g fill="#0d0828">{paths}</g></svg>'


save('palms-backdrop.svg', palms_backdrop())

# ---------------------------------------------------------------- stars for the sky
rng = random.Random(5101)
stars = []
for _ in range(120):
    x, y = rng.uniform(0, 1600), rng.random() ** 1.7 * 520
    r = rng.choice([0.5, 0.6, 0.7, 0.8, 1.0, 1.2])
    stars.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r}" opacity="{f(rng.uniform(0.25, 0.85))}"/>')
for x, y, r in [(180, 70, 7), (520, 34, 5), (930, 96, 6), (1290, 52, 8), (1480, 150, 4.5), (720, 200, 4)]:
    stars.append(f'<path d="{glint(x, y, r, r * 0.8, 0.12)}" opacity=".8"/>')
save('stars.svg', f'<svg {NS} viewBox="0 0 1600 560" preserveAspectRatio="xMidYMin slice"><g fill="#f4ecff">{"".join(stars)}</g></svg>')

# ---------------------------------------------------------------- sunglasses
LENS = 'M14 18H70Q76 18 75 24L71.5 44Q69 57 55 57H29Q15 57 12.5 45L9 24Q8.4 18 14 18Z'


def mirror(d, axis=80):
    def flip(m):
        return f'{f(2 * axis - float(m.group(1)))} {m.group(2)}'
    return re.sub(r'(-?\d+\.?\d*) (-?\d+\.?\d*)', flip, d)


LENS_R = mirror(LENS)
lens_scene = (f'<rect x="0" y="14" width="160" height="30" fill="url(#sky)"/>'
              f'<rect x="0" y="44" width="160" height="16" fill="url(#sea)"/>'
              f'<g mask="url(#sg)"><circle cx="46" cy="44" r="13" fill="url(#ss)"/><circle cx="118" cy="44" r="13" fill="url(#ss)"/></g>'
              f'<path d="M0 44H160" stroke="#ffd2a0" stroke-width=".8"/>'
              f'<path d="M20 50h14M26 53h10M100 50h22M108 53h8" stroke="#ffb36b" stroke-width="1.2" opacity=".7"/>')
save('sunglasses.svg', f'''<svg {NS} viewBox="0 0 160 80">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a8a"/><stop offset=".45" stop-color="{MAGENTA}"/><stop offset=".8" stop-color="{CORAL}"/><stop offset="1" stop-color="{APRICOT}"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2bb3c6"/><stop offset="1" stop-color="#14306e"/></linearGradient>
<linearGradient id="ss" x1="0" y1="0" x2="0" y2="1">{sunset_stops()}</linearGradient>
<mask id="sg"><rect width="160" height="44" fill="#fff"/>{sun_gaps(31, 13, [(0.3, 0.12), (0.62, 0.16)])}</mask>
<linearGradient id="fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1eaff"/><stop offset="1" stop-color="#c8b8ee"/></linearGradient>
<clipPath id="cl"><path d="{LENS}"/><path d="{LENS_R}"/></clipPath>
</defs>
<g transform="translate(3 4)" fill="{SHADOW}" opacity=".5"><path d="{LENS}" stroke="{SHADOW}" stroke-width="8" stroke-linejoin="round"/><path d="{LENS_R}" stroke="{SHADOW}" stroke-width="8" stroke-linejoin="round"/><path d="M70 22Q80 15 90 22V30Q80 24 70 30Z"/></g>
<path d="M4 20Q1 21 1 25" stroke="#c8b8ee" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M156 20Q159 21 159 25" stroke="#c8b8ee" stroke-width="4" fill="none" stroke-linecap="round"/>
<g fill="url(#fr)" stroke="url(#fr)" stroke-width="8" stroke-linejoin="round"><path d="{LENS}"/><path d="{LENS_R}"/></g>
<path d="M70 21Q80 14 90 21V28Q80 22 70 28Z" fill="url(#fr)"/>
<path d="M6 15H74Q80 13 86 15H154" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<g clip-path="url(#cl)">{lens_scene}
<path d="M8 14 30 14 12 60 2 60Z" fill="#fff" opacity=".22"/><path d="M34 14 40 14 22 60 16 60Z" fill="#fff" opacity=".16"/>
<path d="M90 14 110 14 94 60 80 60Z" fill="#fff" opacity=".2"/></g>
{glint_group(22, 24, 9)}{glint_group(132, 50, 5.5, .85)}
</svg>''', MOTIFS)

# ---------------------------------------------------------------- headphones
save('headphones.svg', f'''<svg {NS} viewBox="0 0 140 120">
<defs>
<linearGradient id="ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d9d0f4"/><stop offset=".5" stop-color="#7d6cb8"/><stop offset=".75" stop-color="#c6bbea"/><stop offset="1" stop-color="#f6f2ff"/></linearGradient>
<radialGradient id="fo" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffcf8a"/><stop offset=".45" stop-color="#ff9a4a"/><stop offset=".85" stop-color="#e8582e"/><stop offset="1" stop-color="#b8402a"/></radialGradient>
<radialGradient id="fo2" cx=".62" cy=".34" r=".7"><stop offset="0" stop-color="#ffcf8a"/><stop offset=".45" stop-color="#ff9a4a"/><stop offset=".85" stop-color="#e8582e"/><stop offset="1" stop-color="#b8402a"/></radialGradient>
<pattern id="dots" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r=".45" fill="#9c3418" opacity=".2"/></pattern>
</defs>
<g fill="none" stroke-linecap="round">
<path d="M26 74C24 32 46 12 70 12S116 32 114 74" stroke="{SHADOW}" stroke-width="7" opacity=".45" transform="translate(3 4)"/>
<path d="M26 74C24 32 46 12 70 12S116 32 114 74" stroke="url(#ch)" stroke-width="6"/>
<path d="M30 60C30 34 48 17 70 17" stroke="#fff" stroke-width="1.6" opacity=".9"/>
</g>
<g><rect x="21" y="60" width="9" height="16" rx="3" fill="url(#ch)"/><rect x="110" y="60" width="9" height="16" rx="3" fill="url(#ch)"/></g>
<g transform="translate(3.5 4.5)" fill="{SHADOW}" opacity=".5"><ellipse cx="30" cy="92" rx="16" ry="25"/><ellipse cx="110" cy="92" rx="16" ry="25"/></g>
<ellipse cx="20" cy="92" rx="8" ry="20" fill="url(#ch)"/><ellipse cx="120" cy="92" rx="8" ry="20" fill="url(#ch)"/>
<ellipse cx="31" cy="92" rx="15" ry="25" fill="url(#fo)"/><ellipse cx="109" cy="92" rx="15" ry="25" fill="url(#fo2)"/>
<ellipse cx="31" cy="92" rx="15" ry="25" fill="url(#dots)"/><ellipse cx="109" cy="92" rx="15" ry="25" fill="url(#dots)"/>
<ellipse cx="34" cy="92" rx="6" ry="12" fill="#c84a28" opacity=".3"/><ellipse cx="106" cy="92" rx="6" ry="12" fill="#c84a28" opacity=".3"/>
<path d="M22 76Q26 68 32 68" stroke="#ffe2b0" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M100 76Q104 68 110 68" stroke="#ffe2b0" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
{glint_group(48, 30, 8)}
</svg>''', MOTIFS)

# ---------------------------------------------------------------- cocktail (a tequila sunrise)
GLASS = 'M38 30H82L77 112Q76.5 116 72 116H48Q43.5 116 43 112Z'
save('cocktail.svg', f'''<svg {NS} viewBox="0 0 120 130">
<defs>
<linearGradient id="dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".35" stop-color="{APRICOT}"/><stop offset=".7" stop-color="#ff5a5a"/><stop offset="1" stop-color="{MAGENTA}"/></linearGradient>
<linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".25" stop-color="#fff" stop-opacity=".1"/><stop offset=".8" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></linearGradient>
<radialGradient id="or" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7a8"/><stop offset=".78" stop-color="#ffb347"/><stop offset=".82" stop-color="#fff3d8"/><stop offset="1" stop-color="#ff9a2a"/></radialGradient>
<clipPath id="gc"><path d="{GLASS}"/></clipPath>
</defs>
<path d="{GLASS}" fill="{SHADOW}" opacity=".45" transform="translate(4 4)"/>
<path d="M76 8 92 4 94 7 79 11 66 72 63 71Z" fill="#fff"/><path d="M76 8 92 4 93 5.6 78 9.6Z" fill="{PINK}"/>
<path d="M78.6 16 77.2 22.6 74.4 22 75.8 15.4Z M75.4 31 74 37.6 71.2 37 72.6 30.4Z M72.2 46 70.8 52.6 68 52 69.4 45.4Z" fill="{PINK}"/>
<g clip-path="url(#gc)">
<rect x="30" y="38" width="60" height="80" fill="url(#dr)"/>
<rect x="47" y="44" width="15" height="14" rx="3" fill="#fff" opacity=".35" transform="rotate(-12 54 51)"/>
<rect x="60" y="56" width="14" height="13" rx="3" fill="#fff" opacity=".28" transform="rotate(14 67 62)"/>
<rect x="45" y="66" width="13" height="12" rx="3" fill="#fff" opacity=".22" transform="rotate(6 51 72)"/>
<path d="M30 38H90V41H30Z" fill="#fff" opacity=".6"/>
<rect x="30" y="20" width="60" height="100" fill="url(#gl)"/>
<path d="M44 30H49L52 116H47Z" fill="#fff" opacity=".35"/>
</g>
<path d="{GLASS}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85"/>
<circle cx="40" cy="30" r="13" fill="url(#or)"/>
<path d="M40 19V41M29 30H51M32.2 22.2 47.8 37.8M47.8 22.2 32.2 37.8" stroke="#fff3d8" stroke-width="1.1" opacity=".9"/>
<circle cx="40" cy="30" r="2.2" fill="#fff3d8"/>
<path d="M30 116Q60 126 90 116" stroke="{SHADOW}" stroke-width="3" fill="none" opacity=".25"/>
{glint_group(70, 50, 9)}
</svg>''', MOTIFS)

# ---------------------------------------------------------------- the cassette
def hub(cx, cy, r):
    teeth = ''.join(
        f'<rect x="{f(cx - 1.3)}" y="{f(cy - r * 0.62)}" width="2.6" height="{f(r * 0.26)}" rx=".6" fill="#fbf7ff" transform="rotate({k * 60} {f(cx)} {f(cy)})"/>'
        for k in range(6))
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="#fbf7ff"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.66)}" fill="#2a1d55"/>{teeth}'
            f'<circle cx="{f(cx - r * 0.3)}" cy="{f(cy - r * 0.34)}" r="{f(r * 0.2)}" fill="#fff" opacity=".9"/>')


def screw(cx, cy):
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="3" fill="url(#scr)"/>'
            f'<path d="M{f(cx - 1.8)} {f(cy + 1.1)}L{f(cx + 1.8)} {f(cy - 1.1)}" stroke="#4a3c7a" stroke-width=".9"/>')


def cassette(shell=False, side=True, glints=True):
    """The whole cassette for the design-system page. shell: no hubs, for the
    loader and the audio cover, whose reels are separate so CSS can turn them.
    side and glints: the audio cover stamps its side in Japanese and lights
    its glints on hover, so its shell leaves both out."""
    label_stripes = ''.join(
        f'<rect x="26" y="{y}" width="188" height="{h}" fill="{c}"/>'
        for y, h, c in [(96, 4.6, APRICOT), (102.4, 4.2, CORAL), (108.4, 3.8, PINK), (114, 3.4, MAGENTA), (119.2, 3, VIOLET)])
    letter_a = 'M38 92 44.6 75H48.4L55 92H51.3L49.9 88.2H43.1L41.7 92ZM44.2 85.2H48.8L46.5 79Z'
    reel_l, reel_r = hub(78, 70, 12), hub(162, 70, 12)
    if shell:
        reel_l = '<circle cx="78" cy="70" r="12" fill="#2a1d55"/>'
        reel_r = '<circle cx="162" cy="70" r="12" fill="#2a1d55"/>'
    letter = f'<path d="{letter_a}" fill="#2a1d55"/>' if side else ''
    sparkle = f'{glint_group(66, 58, 11)}{glint_group(214, 112, 7, .9)}' if glints else ''
    return f'''<svg {NS} viewBox="0 0 248 172">
<defs>
<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fefbff"/><stop offset=".55" stop-color="#ece3fb"/><stop offset="1" stop-color="#cbbcec"/></linearGradient>
<linearGradient id="lb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf2"/><stop offset="1" stop-color="#ffeedd"/></linearGradient>
<linearGradient id="wn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2c72"/><stop offset="1" stop-color="#1d1546"/></linearGradient>
<radialGradient id="tp"><stop offset=".3" stop-color="#5a2f2a"/><stop offset=".95" stop-color="#3a1d1f"/><stop offset="1" stop-color="#7a4636"/></radialGradient>
<radialGradient id="scr" cx=".35" cy=".35"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9d90c8"/></radialGradient>
<clipPath id="wc"><rect x="52" y="52" width="136" height="36" rx="18"/></clipPath>
</defs>
<rect x="16" y="16" width="226" height="148" rx="10" fill="{SHADOW}" opacity=".55"/>
<rect x="8" y="8" width="226" height="148" rx="10" fill="url(#sh)"/>
<path d="M62 156 74 132H168L180 156Z" fill="#cbbcec"/>
<path d="M74 132H168L180 156" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".7"/>
<circle cx="92" cy="146" r="4.2" fill="#2a1d55"/><circle cx="150" cy="146" r="4.2" fill="#2a1d55"/>
<rect x="108" y="141" width="7" height="7" rx="1" fill="#2a1d55"/><rect x="127" y="141" width="7" height="7" rx="1" fill="#2a1d55"/>
<rect x="22" y="20" width="198" height="106" rx="6" fill="url(#lb)"/>
<path d="M56 34H212M56 44H212" stroke="#c9bfe6" stroke-width=".9"/>
{label_stripes}
{letter}
<rect x="52" y="52" width="136" height="36" rx="18" fill="url(#wn)"/>
<g clip-path="url(#wc)">
<circle cx="78" cy="70" r="31" fill="url(#tp)"/><circle cx="162" cy="70" r="20" fill="url(#tp)"/>
<path d="M60 52 92 52 70 88 40 88Z" fill="#fff" opacity=".14"/><path d="M98 52 106 52 84 88 76 88Z" fill="#fff" opacity=".1"/>
</g>
{reel_l}{reel_r}
<rect x="52" y="52" width="136" height="36" rx="18" fill="none" stroke="#2a1d55" stroke-width="2"/>
{screw(18, 18)}{screw(224, 18)}{screw(18, 146)}{screw(224, 146)}{screw(121, 140)}
<path d="M8 40V18Q8 8 18 8H84L58 40Z" fill="#fff" opacity=".42"/>
<path d="M92 8H104L78 40H66Z" fill="#fff" opacity=".3"/>
{sparkle}
</svg>'''


save('cassette.svg', cassette(), MOTIFS)
save('tape-shell.svg', cassette(shell=True))
save('reel.svg', f'<svg {NS} viewBox="0 0 24 24">{hub(12, 12, 12)}</svg>')
# The audio cover's tape: the shell with no side letter and no glints, since
# the cover stamps its side in Japanese and lights its glints on hover
save('tape-blank.svg', cassette(shell=True, side=False, glints=False))

# ---------------------------------------------------------------- caustic tile
def caustics(px, cells=5, seed=5101):
    """Periodic Worley F2-F1 with a periodic warp: bright light lines on pool water."""
    from PIL import Image
    r = random.Random(seed)
    pts = {(i, j): (r.random(), r.random()) for i in range(cells) for j in range(cells)}
    im = Image.new('LA', (px, px))
    data = []
    tau = math.tau
    for y in range(px):
        v = y / px
        for x in range(px):
            u = x / px
            wu = u + 0.05 * math.sin(tau * (v * 2 + 0.3)) + 0.025 * math.sin(tau * (u + 2 * v) * 2)
            wv = v + 0.05 * math.sin(tau * (u * 2 + 0.7)) + 0.025 * math.cos(tau * (2 * u - v) * 2)
            gu, gv = wu * cells, wv * cells
            ci, cj = math.floor(gu), math.floor(gv)
            d1 = d2 = 9.0
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    ii, jj = ci + di, cj + dj
                    ox, oy = pts[(ii % cells, jj % cells)]
                    d = math.hypot(ii + ox - gu, jj + oy - gv)
                    if d < d1:
                        d1, d2 = d, d1
                    elif d < d2:
                        d2 = d
            e = d2 - d1
            a = math.exp(-e * 7.0) * 0.55 + math.exp(-e * 26.0) * 0.6
            data.append((255, max(0, min(255, int(a * 165)))))
    im.putdata(data)
    return im


CSS_TILE = 200
for k in (1, 2, 3):
    caustics(CSS_TILE * k).save(os.path.join(ICONS, f'caustic-{k}x.webp'), 'WEBP', lossless=True, quality=100, method=6)
print('icons written to', os.path.normpath(ICONS))
