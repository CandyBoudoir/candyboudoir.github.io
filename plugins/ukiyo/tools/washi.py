# Seamless washi (kozo paper) fibre overlay: soft light fibres, a few faint
# bark flecks and a cloudy formation, on transparent, laid over any flat
# colour. Kozo fibres are long, wavy and translucent, so each one is drawn as
# a tapering strand (thin, faint ends; a soft swelling body), blurred into the
# paper, and added rather than overwritten where fibres cross; short hard
# strokes and dark fibres read as scratches up close. Every fibre is drawn at
# all nine wrap offsets and the formation is periodic noise, so tiles meet
# without a seam. Saved lossless, one file per density, 256px CSS.
#   python3 washi.py ../src/icons
import math, random, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = sys.argv[1]
CSS = 256           # CSS px per tile
SS = 6              # canvas px per CSS px (drawn at 2x the 3x density)
W = CSS * SS
rnd = random.Random(5102)

def value_noise(n, P, seed):
    r = random.Random(seed)
    g = [[r.random() for _ in range(P)] for _ in range(P)]
    out = Image.new('L', (n, n)); px = out.load(); s = P / n
    for y in range(n):
        fy = y * s; j = int(fy); ty = fy - j; ty = ty * ty * (3 - 2 * ty)
        for x in range(n):
            fx = x * s; i = int(fx); tx = fx - i; tx = tx * tx * (3 - 2 * tx)
            a = g[j % P][i % P]; b = g[j % P][(i + 1) % P]; c = g[(j + 1) % P][i % P]; d = g[(j + 1) % P][(i + 1) % P]
            v = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty
            px[x, y] = int(v * 255)
    return out

def strand(alpha, width, length, bundle=None):
    """One kozo fibre as a list of (x, y, alpha, width) samples: a slow wander
    with a gentle wave, faint at both ends and fullest in its middle."""
    if bundle:
        # parallel-ish strands spread across and along the bundle, never from one point
        along, across = rnd.uniform(-90, 90) * SS, rnd.gauss(0, 22 * SS)
        ang = bundle[2] + rnd.gauss(0, 0.12)
        x = bundle[0] + math.cos(ang) * along - math.sin(ang) * across
        y = bundle[1] + math.sin(ang) * along + math.cos(ang) * across
    else:
        x, y, ang = rnd.random() * W, rnd.random() * W, rnd.random() * math.pi * 2
    steps = max(8, int(length / (3 * SS)))
    step = length / steps
    drift = rnd.uniform(-0.012, 0.012)
    wave_f = rnd.uniform(0.08, 0.2); wave_a = rnd.uniform(0.02, 0.06); ph = rnd.random() * 6.28
    pts = []
    for k in range(steps + 1):
        u = k / steps
        env = math.sin(math.pi * u) ** 0.7              # taper
        swell = 0.75 + 0.25 * math.sin(u * 9 + ph)      # uneven body
        pts.append((x, y, alpha * env * swell, max(1, width * (0.45 + 0.55 * env))))
        ang += drift + wave_a * math.sin(k * wave_f + ph) + rnd.uniform(-0.03, 0.03)
        x += math.cos(ang) * step; y += math.sin(ang) * step
    return pts

def draw_batch(fibres, blur):
    """Fibres of one softness, each drawn on its own layer and added, so a
    crossing is denser rather than cut through."""
    acc = Image.new('L', (W, W), 0)
    for pts in fibres:
        lay = Image.new('L', (W, W), 0); d = ImageDraw.Draw(lay)
        for (x0, y0, a0, w0), (x1, y1, a1, w1) in zip(pts, pts[1:]):
            a = int((a0 + a1) / 2); w = int(round((w0 + w1) / 2))
            if a <= 0: continue
            for ox in (-W, 0, W):
                for oy in (-W, 0, W):
                    d.line([(x0 + ox, y0 + oy), (x1 + ox, y1 + oy)], fill=a, width=w)
        acc = ImageChops.add(acc, lay)
    return acc.filter(ImageFilter.GaussianBlur(blur))

# Long fibres, some lying in loose bundles as kozo does
bundles = [(rnd.random() * W, rnd.random() * W, rnd.random() * math.pi * 2) for _ in range(7)]
long_f = [strand(rnd.uniform(34, 58), rnd.choice((3, 4, 5)), rnd.uniform(110, 230) * SS,
                 bundle=rnd.choice(bundles) if rnd.random() < 0.55 else None) for _ in range(46)]
fine_f = [strand(rnd.uniform(26, 42), rnd.choice((2, 3)), rnd.uniform(50, 140) * SS) for _ in range(120)]
wisps = [strand(rnd.uniform(7, 12), rnd.choice((10, 14, 18)), rnd.uniform(90, 200) * SS) for _ in range(26)]

light = ImageChops.add(draw_batch(long_f, 2.6), draw_batch(fine_f, 2.0))
light = ImageChops.add(light, draw_batch(wisps, 9))

# Bark flecks: few, small, irregular and soft, never a dot grid
dark = Image.new('L', (W, W), 0)
dd = ImageDraw.Draw(dark)
for _ in range(95):
    cx, cy = rnd.random() * W, rnd.random() * W
    r = rnd.uniform(0.6, 1.6) * SS / 2
    blob = [(cx + math.cos(t) * r * rnd.uniform(0.6, 1.5), cy + math.sin(t) * r * rnd.uniform(0.6, 1.5))
            for t in [i * math.pi / 4 for i in range(8)]]
    a = rnd.randint(40, 80)
    for ox in (-W, 0, W):
        for oy in (-W, 0, W):
            dd.polygon([(x + ox, y + oy) for x, y in blob], fill=a)
dark = dark.filter(ImageFilter.GaussianBlur(1.8))

# cloudy formation: thicker and thinner paper, periodic
cloud = value_noise(CSS // 2, 5, 7).resize((W, W), Image.BICUBIC)
cloud2 = value_noise(CSS // 2, 11, 8).resize((W, W), Image.BICUBIC)

def tile(size):
    def wrapped(im):
        big = Image.new(im.mode, (W * 3, W * 3))
        for i in range(3):
            for j in range(3): big.paste(im, (i * W, j * W))
        big = big.resize((size * 3, size * 3), Image.LANCZOS)
        return big.crop((size, size, 2 * size, 2 * size))
    L = wrapped(light); D = wrapped(dark); C = wrapped(cloud); C2 = wrapped(cloud2)
    out = Image.new('RGBA', (size, size)); o = out.load()
    lp, dp, cp, cp2 = L.load(), D.load(), C.load(), C2.load()
    for y in range(size):
        for x in range(size):
            c = (cp[x, y] * 0.65 + cp2[x, y] * 0.35) / 255 - 0.5
            la = lp[x, y] * 0.8 + max(0, c) * 24
            da = dp[x, y] + max(0, -c) * 16
            if la >= da:
                o[x, y] = (250, 244, 228, min(255, int(la - da * 0.5)))
            else:
                o[x, y] = (40, 30, 22, min(255, int(da - la * 0.5)))
    return out

for n, s in (('3x', 3), ('2x', 2), ('1x', 1)):
    t = tile(CSS * s)
    t.save(f'{OUT}/washi-{n}.webp', lossless=True, quality=100, method=6)
    print(n, t.size)
