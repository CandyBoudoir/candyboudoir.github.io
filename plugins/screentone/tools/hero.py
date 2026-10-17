"""Screentone: the hero page of panels and the empty-state panel.

The hero is layered so SFW mode can drop the figures and the voice and keep
the page: tone (panel fills), the two figure crops, ink (frames) and voice
(the bubble and SFX). Every layer covers the whole art box, so the CSS only
stacks them. The hero goes to the design-system page (design-system/ds/hero)
and the empty-state panel, the one figure the plugin ships, to src/icons.

The figures are crops of two renders made locally with Qwen-Image 2512
(Apache 2.0), which are not kept in the repo; pass the folder that holds
tone-eyes-5101.png and tone-glance-5101.png.

usage, from the repo root after pnpm install (needs fonttools and Pillow):
  uvx --from 'fonttools[woff]==4.66.1' --with pillow python -I \
    plugins/screentone/tools/hero.py <renders-folder>
"""
import importlib.util
import math
import os
import random
import sys
import tempfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('icons', os.path.join(HERE, 'icons.py'))
ic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ic)

RENDERS = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(ic.PLUGIN, 'design-system', 'ds', 'hero')
W, H = 500, 620
SCALE = 2  # figure crops are written at 2x the CSS box

# Panels (CSS px in a 500 x 620 box). A: the eyes, B: the glance, C: the bubble.
SLOPE = -0.06


def cut(x, y0):
    """The slanted rule under the eyes panel, offset to y0 at x = 0."""
    return y0 + SLOPE * x


A_BOTTOM = 318
GUT = 14
C_TOP = A_BOTTOM + GUT
SPLIT_TOP, SPLIT_BOTTOM = 202, 186  # the slanted rule between C and B
M = 3
PANELS = {
    'A': [(M, M), (W - M, M), (W - M, cut(W - M, A_BOTTOM)), (M, cut(M, A_BOTTOM))],
    'C': [(M, cut(M, C_TOP)), (SPLIT_TOP - GUT / 2, cut(SPLIT_TOP - GUT / 2, C_TOP)),
          (SPLIT_BOTTOM - GUT / 2, H - M), (M, H - M)],
    'B': [(SPLIT_TOP + GUT / 2, cut(SPLIT_TOP + GUT / 2, C_TOP)), (W - M, cut(W - M, C_TOP)),
          (W - M, H - M), (SPLIT_BOTTOM + GUT / 2, H - M)],
}

# Crop windows in render pixels as (centre x, centre y, width), chosen by eye
# for each seed; the height follows from the panel's shape.
CROPS = {
    'eyes': ('tone-eyes-5101.png', (832, 480, 1160)),
    'glance': ('tone-glance-5101.png', (500, 470, 740)),
}


def pts(poly, s=1):
    return ' '.join(f'{ic.r(x * s)},{ic.r(y * s)}' for x, y in poly)


def bbox(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def figure(name, panel, out):
    file, crop = CROPS[name]
    src = os.path.join(RENDERS, file)
    if not os.path.exists(src):
        print('missing', src)
        return False
    im = Image.open(src).convert('RGB')
    x0, y0, x1, y1 = bbox(PANELS[panel])
    bw, bh = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
    r = bw / bh
    iw, ih = im.size
    if crop is None:
        # A cover crop from the top, centred across
        if iw / ih > r:
            cw = ih * r
            crop = ((iw - cw) / 2, 0, (iw + cw) / 2, ih)
        else:
            crop = (0, 0, iw, iw / r)
    else:
        cx, cy, cw = crop
        ch = cw / r
        crop = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    part = im.crop(tuple(round(v) for v in crop)).resize((bw, bh), Image.LANCZOS)
    canvas = Image.new('RGBA', (W * SCALE, H * SCALE), (0, 0, 0, 0))
    canvas.paste(part, (round(x0 * SCALE), round(y0 * SCALE)))
    mask = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(mask).polygon([(x * SCALE, y * SCALE) for x, y in PANELS[panel]], fill=255)
    canvas.putalpha(mask)
    canvas.save(os.path.join(OUT, out), quality=82, alpha_quality=90, method=6)
    print('wrote', out, crop)
    return True


def tone_dots(id_, poly, grow='down', ink='#fdfcf9', step=7.0, rad=2.4):
    """A gradient tone: a dot lattice faded across the panel by a gradient mask."""
    x0, y0, x1, y1 = bbox(poly)
    a, b = ('0', '1') if grow == 'down' else ('1', '0')
    return (f'<defs><pattern id="{id_}p" width="{step}" height="{step}" patternUnits="userSpaceOnUse" '
            f'patternTransform="rotate(45)"><circle cx="{step / 2}" cy="{step / 2}" r="{rad}" fill="{ink}"/></pattern>'
            f'<linearGradient id="{id_}g" x1="0" y1="{a}" x2="0" y2="{b}">'
            f'<stop offset="0" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff"/></linearGradient>'
            f'<mask id="{id_}m"><rect x="{ic.r(x0)}" y="{ic.r(y0)}" width="{ic.r(x1 - x0)}" height="{ic.r(y1 - y0)}" fill="url(#{id_}g)"/></mask></defs>'
            f'<rect x="{ic.r(x0)}" y="{ic.r(y0)}" width="{ic.r(x1 - x0)}" height="{ic.r(y1 - y0)}" fill="url(#{id_}p)" mask="url(#{id_}m)"/>')


def svg(name, body):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">{body}</svg>\n')


def hero():
    ok_eyes = figure('eyes', 'A', 'hero-eyes.webp')
    ok_glance = figure('glance', 'B', 'hero-glance.webp')

    # Tone: what each panel shows under its figure (and alone in SFW mode).
    # Without the glance, panel B holds the favourite's heart in focus lines.
    ax0, ay0, ax1, ay1 = bbox(PANELS['A'])
    cx, cy = (ax0 + ax1) / 2, (ay0 + ay1) / 2 + 10
    bx0, by0, bx1, by1 = bbox(PANELS['B'])
    hx, hy = (bx0 + bx1) / 2 + 6, (by0 + by1) / 2 + 14
    defs = ''.join(f'<clipPath id="{k}"><polygon points="{pts(v)}"/></clipPath>' for k, v in PANELS.items())
    if ok_glance:
        b_fill = f'<rect width="{W}" height="{H}" fill="#0a0a0a"/>{tone_dots("tb", PANELS["B"], "up")}'
    else:
        b_fill = (f'<rect width="{W}" height="{H}" fill="#000"/>'
                  f'<path d="{ic.focus_wedges(hx, hy, 74, 300, 110, 8, 0.5, 1.8)}" fill="#fdfcf9"/>'
                  f'<g transform="translate({ic.r(hx - 62)} {ic.r(hy - 60)}) scale(1.24) rotate(-8 50 50)">'
                  f'<path d="{ic.HEART}" fill="{ic.SPOT}" stroke="#fdfcf9" stroke-width="4" stroke-linejoin="round"/>'
                  f'{ic.HEART_SHINE}</g>')
    tone = (f'<defs>{defs}</defs>'
            f'<g clip-path="url(#A)"><rect width="{W}" height="{H}" fill="#000"/>'
            f'<path d="{ic.focus_wedges(cx, cy, 70, 420, 150, 21, 0.4, 1.5)}" fill="#fdfcf9"/></g>'
            f'<g clip-path="url(#B)">{b_fill}</g>'
            f'<g clip-path="url(#C)"><rect width="{W}" height="{H}" fill="#0a0a0a"/>{tone_dots("tc", PANELS["C"], "down")}</g>')
    svg('hero-tone.svg', tone)

    # Ink: the frames, white with a black edge so they hold against paper art
    frames = ''.join(f'<polygon points="{pts(v)}"/>' for v in PANELS.values())
    ink = (f'<g fill="none" stroke-linejoin="miter">'
           f'<g stroke="#000" stroke-width="9">{frames}</g>'
           f'<g stroke="#fdfcf9" stroke-width="4.5">{frames}</g></g>')
    svg('hero-ink.svg', ink)

    # Voice: her line in a bubble breaking out of panel C, and the SFX
    bx, by = 104, 448
    # Her line: she caught you staring, and she likes it
    lines = ['STARING', 'AGAIN?', 'GOOD.', 'DON’T STOP.']
    text = ''
    for i, line in enumerate(lines):
        d, _ = ic.centred('letter', line, 24, bx, by - 32 + i * 22, 0.5, skew=ic.LEAN)
        text += d
    bubble = ic.bubble_path(bx, by, 88, 66, (bx + 106, by + 40), 20, 11)
    jit = [(0, 0, -6, 1), (0, 0, 0, 1)]
    _, jb = ic.letters('dela', 'ジー', 50, 0, 0, -6, jit, skew=8, sx=[1, 1.8])
    jii, jb = ic.letters('dela', 'ジー', 50, 34 - jb[0], 282 - jb[3], -6, jit, skew=8, sx=[1, 1.8])
    if ok_glance:
        word, wjit, size = 'ニヤ', [(0, 0, -12, 0.9), (0, -6, 6, 1.05)], 42
    else:
        word, wjit, size = 'ドキッ', [(0, 0, -10, 1.0), (0, -8, 7, 0.92), (2, -12, 14, 0.62)], 46
    _, nb = ic.letters('dela', word, size, 0, 0, -3, wjit, skew=10)
    sfx, nb = ic.letters('dela', word, size, W - 18 - nb[2], C_TOP + 30 - nb[1] - 8, -3, wjit, skew=10)
    voice = (f'<path d="{bubble}" fill="#fdfcf9" stroke="#000" stroke-width="3"/>'
             f'<path d="{text}" fill="#000"/>'
             + ic.inked('j', jii, '#fdfcf9', [('#000', 9)])
             + ic.inked('n', sfx, '#ff4d6d', [('#fdfcf9', 12), ('#000', 6)]))
    svg('hero-voice.svg', voice)
    return ok_eyes, ok_glance


def empty_panel(name, crop, sfx=None):
    """The empty state: her, in a small panel, with a …… bubble.

    Drawn at 2x for a 170 x 150 CSS box: a slanted panel with the figure
    cropped close, a silent bubble breaking its frame, and an optional SFX
    in the corner.
    """
    src = os.path.join(RENDERS, CROPS[name][0])
    if not os.path.exists(src):
        print('missing', src)
        return False
    from PIL import ImageFont
    cw, chh = 340, 300
    canvas = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    panel = [(8, 44), (236, 34), (230, 292), (4, 296)]
    x0, y0, x1, y1 = bbox(panel)
    im = Image.open(src).convert('RGB')
    bw, bh = round(x1 - x0), round(y1 - y0)
    cx, cy, cwid = crop
    chgt = cwid * bh / bw
    part = im.crop((round(cx - cwid / 2), round(cy - chgt / 2), round(cx + cwid / 2), round(cy + chgt / 2)))
    part = part.resize((bw, bh), Image.LANCZOS)
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(part, (round(x0), round(y0)))
    mask = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(mask).polygon(panel, fill=255)
    layer.putalpha(mask)
    canvas.alpha_composite(layer)
    d = ImageDraw.Draw(canvas)
    d.line(panel + [panel[0]], fill=(0, 0, 0, 255), width=12, joint='curve')
    d.line(panel + [panel[0]], fill=(253, 252, 249, 255), width=6, joint='curve')
    # The silent bubble, breaking the frame at top right
    bx, by, rx, ry = 262, 64, 70, 46
    tail = [(bx - 40, by + 30), (bx - 14, by + 40), (bx - 66, by + 82)]
    d.polygon(tail, fill=(0, 0, 0, 255))
    d.ellipse((bx - rx - 4, by - ry - 4, bx + rx + 4, by + ry + 4), fill=(0, 0, 0, 255))
    d.ellipse((bx - rx, by - ry, bx + rx, by + ry), fill=(253, 252, 249, 255))
    d.polygon([(bx - 38, by + 26), (bx - 18, by + 34), (bx - 60, by + 74)], fill=(253, 252, 249, 255))
    for i in range(6):
        x = bx - 38 + i * 13 + (6 if i > 2 else 0)
        d.ellipse((x - 3.6, by - 3.6, x + 3.6, by + 3.6), fill=(0, 0, 0, 255))
    if sfx:
        # The SFX, white on a black stroke
        # Pillow reads TrueType, so the SFX subset is unpacked from WOFF2 first
        with tempfile.NamedTemporaryFile(suffix='.ttf') as ttf:
            sub = ic.FONTS['dela'][1]
            sub.flavor = None
            sub.save(ttf.name)
            sub.flavor = 'woff2'
            f = ImageFont.truetype(ttf.name, 46)
            t = Image.new('RGBA', (160, 90), (0, 0, 0, 0))
            ImageDraw.Draw(t).text((10, 6), sfx, font=f, fill=(253, 252, 249, 255), stroke_width=6,
                                   stroke_fill=(0, 0, 0, 255))
        t = t.rotate(12, resample=Image.BICUBIC, expand=True)
        canvas.alpha_composite(t, (196, 196))
    canvas.save(os.path.join(ic.SHIPPED, 'empty-panel.webp'), quality=84, alpha_quality=90, method=6)
    print('wrote empty-panel.webp')
    return True


if __name__ == '__main__':
    print(hero())
    # Her looking back (ぷい, turning away in a huff) when the glance exists,
    # else the stare, which says nothing just as well.
    print(empty_panel('glance', (500, 400, 470), 'ぷい') or empty_panel('eyes', (832, 500, 700)))
