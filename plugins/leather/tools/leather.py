# Seamless pebble-grain leather. Every noise term is periodic on the tile and
# the normals wrap at the edges, so copies of the tile meet without a seam.
#
#   LP="<settings>" python3 leather.py leather|grain <size> <cells> <out.png>
#
# <size> is the 3x tile in pixels and <cells> the number of pebbles across it.
# It writes <out>-3x.png, -2x.png and -1x.png; the smaller two are resampled
# from a 3x3 tiling, so their edges still wrap. Convert each to lossless WebP:
#
#   cwebp -lossless -z 9 -exact -metadata none in.png -o out.webp
#
# Lossy WebP alters edge pixels and draws a faint line at every repeat. Leather
# shows the tiles at their native CSS size (384px leather, 192px grain) and one
# file per screen density, since a tile resampled to another size seams too.
# LP holds the shading settings, as KEY=value pairs; for example:
#
#   LP="BR=2,PL=0.55,DW=0.7,FW=0.1,KK=4.0,SE=9,SA=0.55,AO=0.26,AMB=0.32,DIF=0.98" \
#     python3 leather.py leather 1152 93 leather.png
#
# Grain mode, with GA added, writes light and shadow only, with alpha, for
# laying over dyed leather.
import math
import os
import random
import sys

from PIL import Image

def worley(W, N, seed):
    rnd = random.Random(seed)
    c = W / N
    jit = [[(JL + (JH - JL) * rnd.random(), JL + (JH - JL) * rnd.random()) for _ in range(N)] for _ in range(N)]
    pts = {}
    def pt(i, j):
        jx, jy = jit[i % N][j % N]
        return ((i + jx) * c, (j + jy) * c)
    F1 = [0.0] * (W * W); F2 = [0.0] * (W * W)
    near = [[None] * N for _ in range(N)]
    for ci in range(N):
        for cj in range(N):
            near[ci][cj] = [pt(ci + di, cj + dj) for di in (-1, 0, 1) for dj in (-1, 0, 1)]
    for y in range(W):
        cj = int(y / c)
        if cj >= N: cj = N - 1
        for x in range(W):
            ci = int(x / c)
            if ci >= N: ci = N - 1
            a = b = 1e9
            for px, py in near[ci][cj]:
                d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2
                if d < a: b = a; a = d
                elif d < b: b = d
            k = y * W + x
            F1[k] = math.sqrt(a) / c; F2[k] = math.sqrt(b) / c
    return F1, F2

def value_noise(W, P, seed):
    # periodic bilinear-smoothstep value noise with P lattice cells across
    rnd = random.Random(seed)
    g = [[rnd.random() for _ in range(P)] for _ in range(P)]
    out = [0.0] * (W * W); s = P / W
    for y in range(W):
        fy = y * s; j = int(fy); ty = fy - j; ty = ty * ty * (3 - 2 * ty)
        for x in range(W):
            fx = x * s; i = int(fx); tx = fx - i; tx = tx * tx * (3 - 2 * tx)
            a = g[j % P][i % P]; b = g[j % P][(i + 1) % P]; c = g[(j + 1) % P][i % P]; d = g[(j + 1) % P][(i + 1) % P]
            out[y * W + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty
    return out

def wrap_blur(A, W, r, passes):
    # separable box blur with wraparound; three passes approximate a gaussian
    n = 2 * r + 1
    for _ in range(passes):
        B = [0.0] * (W * W)
        for y in range(W):
            row = A[y * W:(y + 1) * W]; acc = sum(row[(i) % W] for i in range(-r, r + 1))
            for x in range(W):
                B[y * W + x] = acc / n
                acc += row[(x + r + 1) % W] - row[(x - r) % W]
        A = [0.0] * (W * W)
        for x in range(W):
            col = B[x::W]; acc = sum(col[i % W] for i in range(-r, r + 1))
            for y in range(W):
                A[y * W + x] = acc / n
                acc += col[(y + r + 1) % W] - col[(y - r) % W]
    return A

def smooth(e0, e1, v):
    t = min(1.0, max(0.0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t)

def build(W, N, seed, base, mode, out):
    F1, F2 = worley(W, N, seed)
    f1, f2 = worley(W, int(N * 2.6), seed + 1)
    mot = value_noise(W, 6, seed + 2) if MA else [0.5] * (W * W)
    rnd = random.Random(seed + 3)
    H = [0.0] * (W * W); P = [0.0] * (W * W)
    for k in range(W * W):
        e = F2[k] - F1[k]
        plate = smooth(0.0, PL, e)
        dome = 1 - min(1.0, F1[k] / 0.85) ** 2
        fine = smooth(0.0, 0.3, f2[k] - f1[k])
        H[k] = plate * (1 - DW + DW * dome) + FW * fine + (rnd.random() - 0.5) * 0.025
        P[k] = plate
    H = wrap_blur(H, W, int(BR), 3) if BR else H
    L = (-0.55, -0.62, 0.56); ln = math.sqrt(sum(v * v for v in L)); L = tuple(v / ln for v in L)
    Hh = (L[0], L[1], L[2] + 1); hn = math.sqrt(sum(v * v for v in Hh)); Hh = tuple(v / hn for v in Hh)
    K = KK
    img = Image.new('RGBA' if mode == 'grain' else 'RGB', (W, W)); px = img.load()
    vals = []
    for y in range(W):
        for x in range(W):
            k = y * W + x
            dx = H[y * W + (x + 1) % W] - H[y * W + (x - 1) % W]
            dy = H[((y + 1) % W) * W + x] - H[((y - 1) % W) * W + x]
            nx, ny, nz = -K * dx, -K * dy, 1.0
            n = math.sqrt(nx * nx + ny * ny + nz * nz); nx /= n; ny /= n; nz /= n
            dif = max(0.0, nx * L[0] + ny * L[1] + nz * L[2])
            spec = (max(0.0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]) ** SE) * SA
            ao = 1 - AO + AO * P[k]
            m = 1.0 + MA * (mot[k] - 0.5)
            vals.append((dif, spec, ao, m))
    mean = sum((AMB + DIF * d) * a * m for d, s, a, m in vals) / len(vals)
    for k, (dif, spec, ao, m) in enumerate(vals):
        x = k % W; y = k // W
        f = (AMB + DIF * dif) * ao * m
        if mode == 'leather':
            r = base[0] * f / mean + spec * 62; g = base[1] * f / mean + spec * 58; b = base[2] * f / mean + spec * 62
            px[x, y] = (min(255, int(r)), min(255, int(g)), min(255, int(b)))
        else:
            d = (f - mean) / mean
            if d >= 0: a = min(255, int(d * GA * 150 + spec * 110 * GA)); px[x, y] = (255, 250, 248, a)
            else: px[x, y] = (0, 0, 0, min(255, int(-d * GA * 230)))
    def wrapped(im, size):
        big = Image.new(im.mode, (im.size[0] * 3, im.size[1] * 3))
        for i in range(3):
            for j in range(3): big.paste(im, (i * im.size[0], j * im.size[1]))
        big = big.resize((size * 3, size * 3), Image.LANCZOS)
        return big.crop((size, size, 2 * size, 2 * size))
    base = out.rsplit('.', 1)[0]
    for n, scale in (('3x', 3), ('2x', 2), ('1x', 1)):
        t = img if scale == 3 else wrapped(img, W * scale // 3)
        t.save(f'{base}-{n}.png')
    print(out, 'mean', round(mean, 3))

P_ = dict(MA=0.0, JL=0.0, JH=1.0, GA=1.0, BR=0, PL=0.3, DW=0.38, FW=0.16, KK=2.4, SE=28, SA=1.0, AO=0.38, AMB=0.42, DIF=0.85)
for kv in os.environ.get('LP', '').split(','):
    if kv: k, v = kv.split('='); P_[k] = float(v)
globals().update(P_)
W = int(sys.argv[2]); N = int(sys.argv[3])
build(W, N, 41, (22, 18, 20), sys.argv[1], sys.argv[4])
