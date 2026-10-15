# Cut a product render off its white background. Background and soft shadows
# connected to the border become black with alpha from how dark they are, so
# shadows survive as soft shadows on any dark page. Then trim and resize.
#
#   python3 cutout.py render.png out.webp <size>
import sys
from collections import deque
from PIL import Image

src, dest, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB'); w, h = im.size; px = im.load()
cs = [px[x, y] for x in (0, 1, 2, w - 3, w - 2, w - 1) for y in (0, 1, 2, h - 3, h - 2, h - 1)]
key = tuple(sorted(c[i] for c in cs)[len(cs) // 2] for i in range(3))
kl = 0.299 * key[0] + 0.587 * key[1] + 0.114 * key[2]
# Local contrast: background and soft shadows are smooth, chrome is not.
lum = [0.0] * (w * h)
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]; lum[y * w + x] = 0.299 * r + 0.587 * g + 0.114 * b
def rough(x, y):
    l = lum[y * w + x]; m = 0.0
    for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2), (2, 2), (-2, -2), (2, -2), (-2, 2)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h: m = max(m, abs(lum[ny * w + nx] - l))
    return m
def bgish_at(x, y):
    c = px[x, y]; sat = max(c) - min(c)
    d = max(abs(c[i] - key[i]) for i in range(3))
    if sat >= 28 or d >= 90: return False
    return d < 10 or rough(x, y) < 9
region = bytearray(w * h)
seen = bytearray(w * h)
def dkey(c): return max(abs(c[i] - key[i]) for i in range(3))
# Label every component of background-like pixels. Keep it as background when
# it touches the border, or when it is a large enclosed patch of flat key
# colour (the hole inside a collar or an O-ring); small or textured bright
# patches are chrome highlights and stay opaque.
for sy in range(h):
    for sx in range(w):
        i0 = sy * w + sx
        if seen[i0] or not bgish_at(sx, sy): continue
        comp = []; border = False; flat = 0; q = deque([(sx, sy)]); seen[i0] = 1
        while q:
            x, y = q.popleft(); comp.append(y * w + x)
            if x in (0, w - 1) or y in (0, h - 1): border = True
            if dkey(px[x, y]) < 14: flat += 1
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if not seen[j] and bgish_at(nx, ny): seen[j] = 1; q.append((nx, ny))
        if border or (len(comp) > 1500 and flat / len(comp) > 0.6):
            for j in comp: region[j] = 1
# Defringe: light antialiased pixels within two pixels of the background
# join it, so no pale outline shows on a dark page.
edge = bytearray(w * h)
for y in range(h):
    for x in range(w):
        i = y * w + x
        if region[i]: continue
        c = px[x, y]
        if max(c) - min(c) >= 40 or lum[i] < 70: continue
        r = 5 if lum[i] > 150 else 2
        if any(0 <= x + dx < w and 0 <= y + dy < h and region[(y + dy) * w + x + dx]
               for dx in range(-r, r + 1) for dy in range(-r, r + 1)):
            edge[i] = 1
for i in range(w * h):
    if edge[i]: region[i] = 1
out = Image.new('RGBA', (w, h)); o = out.load()
for y in range(h):
    for x in range(w):
        c = px[x, y]
        if not region[y * w + x]: o[x, y] = (*c, 255); continue
        L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
        a = max(0.0, min(1.0, (kl - L) / kl * 1.15))
        if a < 0.05: o[x, y] = (0, 0, 0, 0); continue
        f = tuple(max(0, min(255, round((c[i] - (1 - a) * key[i]) / a))) for i in range(3))
        o[x, y] = (*f, round(255 * a))
bb = out.getbbox(); pad = 12
out = out.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(w, bb[2] + pad), min(h, bb[3] + pad)))
side = max(out.size); sq = Image.new('RGBA', (side, side)); sq.paste(out, ((side - out.size[0]) // 2, (side - out.size[1]) // 2))
sq = sq.resize((size, size), Image.LANCZOS)
sq.save(dest, quality=88, alpha_quality=90, method=6)
print(dest, 'key', key, 'bbox', bb)
