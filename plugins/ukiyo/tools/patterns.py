# Pattern tiles and the brush keyline, as inline-free SVG files.
#   python3 patterns.py ../src/icons
import math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from geom import fmt, poly

OUT = sys.argv[1]

def save(name, body, w, h):
    open(os.path.join(OUT, name), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>')

def seigaiha(name, bg, line, hi, W=40):
    """Overlapping wave scales. Rows drawn top to bottom so each lower row
    covers the one above; period W across and W/2 down."""
    R = W / 2; H = W / 2; out = []
    for j in range(-2, 5):
        y = j * H / 2; off = (j % 2) * R
        for i in range(-1, 3):
            x = i * W + off
            out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(R - 0.5)}" fill="{bg}" stroke="{hi}" stroke-width="1.3"/>')
            for k in (0.74, 0.5, 0.26):
                out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(R * k)}" fill="none" stroke="{line}" stroke-width="1.1"/>')
    save(name, f'<rect width="{W}" height="{H}" fill="{bg}"/>' + ''.join(out), W, int(H))

def asanoha(name, colour, opacity, s=28):
    """Hemp leaf: a triangular lattice, each triangle joined to its centre."""
    h = s * math.sqrt(3) / 2
    W, H = s, 2 * h
    pts = {}
    for j in range(-2, 5):
        for i in range(-2, 4):
            pts[(i, j)] = (i * s + (j % 2) * s / 2, j * h)
    lines = set()
    def L(a, b):
        key = tuple(sorted((tuple(round(v, 3) for v in a), tuple(round(v, 3) for v in b))))
        lines.add(key)
    for j in range(-2, 4):
        for i in range(-2, 3):
            a = pts[(i, j)]; b = pts[(i + 1, j)]
            # the two triangles between this row and the next
            if j % 2 == 0:
                c = pts[(i, j + 1)]; d = pts[(i + 1, j + 1)]
                tris = [(a, b, c), (b, c, d)]
            else:
                c = pts[(i + 1, j + 1)]; d = pts[(i, j + 1)]
                tris = [(a, b, c), (a, d, c)]
            for t in tris:
                cx = sum(p[0] for p in t) / 3; cy = sum(p[1] for p in t) / 3
                for p in t:
                    L(p, (cx, cy))
                L(t[0], t[1]); L(t[1], t[2]); L(t[0], t[2])
    d = ''.join(f'M{fmt(a[0])} {fmt(a[1])}L{fmt(b[0])} {fmt(b[1])}' for a, b in lines)
    save(name, f'<path d="{d}" fill="none" stroke="{colour}" stroke-opacity="{opacity}" stroke-width="1"/>', fmt(W), fmt(H))

def carved(name, colour, seed, size=300, lo=1.0, hi=2.4, r=2.5, slice_=3):
    """A hand-cut keyline for border-image (slice 3, so 1:1 at a 3px border
    image width). The outside edge is the block's edge, near straight with
    soft corners; the inside edge is where the knife went, so it swells and
    thins along the line, with an occasional nick, and runs a little heavier
    where the cut turns a corner. 300 units long, so on a card the variation
    lands at about its own size."""
    rnd = random.Random(seed)
    N = 44
    knots = [rnd.uniform(lo, hi) for _ in range(N)]
    nicks = [(rnd.random(), rnd.choice((-1, 1)) * rnd.uniform(0.35, 0.6), rnd.uniform(0.004, 0.009)) for _ in range(9)]
    def thick(u):
        x = (u % 1) * N; i = int(x) % N; t = x - int(x); t = t * t * (3 - 2 * t)
        v = knots[i] + (knots[(i + 1) % N] - knots[i]) * t
        for c, a, w in nicks:
            d = min(abs(u - c), 1 - abs(u - c))
            if d < w: v += a * (1 - d / w)
        return max(0.7, min(slice_ - 0.4, v))
    o = 0.4; S = size - 0.4; L = S - o - 2 * r
    arc = math.pi * r / 2
    per = 4 * (L + arc)
    outer, inner = [], []
    corners = [(S - r, o + r), (S - r, S - r), (o + r, S - r), (o + r, o + r)]
    starts = [(o + r, o), (S, o + r), (S - r, S), (o, S - r)]
    dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    n = 760
    for k in range(n):
        d = per * k / n; side = int(d // (L + arc)); f = d - side * (L + arc)
        u = k / n
        if f < L:
            sx, sy = starts[side]; dx, dy = dirs[side]
            p = (sx + dx * f, sy + dy * f); nx, ny = -dy, dx      # inward normal
            wob = 0.18 * math.sin(u * 37 + side)                    # the block edge is near straight
            p = (p[0] - nx * wob * 0.5, p[1] - ny * wob * 0.5)
            t = thick(u)
        else:
            a = (f - L) / r - math.pi / 2 + side * math.pi / 2
            cx, cy = corners[side]
            p = (cx + math.cos(a) * r, cy + math.sin(a) * r); nx, ny = -math.cos(a), -math.sin(a)
            t = min(r - 0.2, thick(u) * 1.12)                        # heavier at the turn
        outer.append(p); inner.append((p[0] + nx * t, p[1] + ny * t))
    path = poly(outer) + poly(inner[::-1])
    save(name, f'<path d="{path}" fill="{colour}" fill-rule="evenodd"/>', size, size)

def chevron(name, colour):
    open(os.path.join(OUT, name), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M2 4.2 6 8.2l4-4" fill="none" stroke="{colour}" stroke-width="1.8" stroke-linecap="square"/></svg>')

seigaiha('seigaiha.svg', '#0f2348', '#24497f', '#3b6cad')
seigaiha('seigaiha-ink.svg', '#0b1730', '#1a3561', '#264a80')
asanoha('asanoha.svg', '#efe4cc', 0.055)
chevron('chevron.svg', '#efe4cc')
carved('keyline-card.svg', '#3b4d74', 21)
carved('keyline-sumi.svg', '#15110f', 34, lo=1.1, hi=2.6)
print('ok')
