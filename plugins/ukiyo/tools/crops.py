# Crops of the two prints, rendered locally with Qwen-Image 2512 (Apache 2.0),
# into WebP. The renders themselves stay out of the repo: the night print
# (ukiyo-night-5101.png) and the beauty print (ukiyo-bijin-5101.png). The
# whole night print belongs to the design-system page (design-system/ds/prints);
# every other crop ships in the plugin (src/icons).
#   python3 crops.py RENDERS_DIR OUT_DIR
import sys
from PIL import Image

R, OUT = sys.argv[1], sys.argv[2]

def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

night = Image.open(f'{R}/ukiyo-night-5101.png').convert('RGB')

# The whole print with its paper margin, for the design-system page's hero
# (shown about 560px wide)
night.resize((1120, round(1120 * night.height / night.width)), Image.LANCZOS).save(
    f'{OUT}/night-print.webp', quality=82, method=6)

# The sea along the foot of the print, as a page-edge backdrop: alpha fades in
# from the top and the strength is baked in, so CSS needs no mask
sea = night.crop((62, 560, 1604, 905)).convert('RGBA')
w, h = sea.size
a = Image.new('L', (w, h))
px = a.load()
for y in range(h):
    v = smooth((y / h) / 0.7) * 0.2
    for x in range(w):
        edge = smooth(min(x, w - 1 - x) / (w * 0.06))
        px[x, y] = int(255 * v * (0.35 + 0.65 * edge))
sea.putalpha(a)
sea = sea.resize((1540, round(1540 * h / w)), Image.LANCZOS)
sea.save(f'{OUT}/night-sea.webp', quality=80, alpha_quality=80, method=6)

# The lantern row along the canal, for the right end of the navbar,
# fading in from the left and out at the foot, so a taller navbar shows no edge
lan = night.crop((860, 262, 1606, 418)).convert('RGBA')
w, h = lan.size
a = Image.new('L', (w, h)); px = a.load()
for y in range(h):
    for x in range(w):
        px[x, y] = int(255 * smooth(x / (w * 0.55)) * smooth((h - y) / (h * 0.28)))
lan.putalpha(a)
lan = lan.resize((round(104 * w / h), 104), Image.LANCZOS)
lan.save(f'{OUT}/night-lanterns.webp', quality=82, alpha_quality=80, method=6)
print('ok', sea.size, lan.size)

# The beauty print (bijin-ga) of a courtesan, a tall vertical print,
# for the design-system page's hero and the empty states; hidden in SFW mode. Shown about
# 180px wide at most, so 2.3x here.
bijin = Image.open(f'{R}/ukiyo-bijin-5101.png').convert('RGB')
bijin.resize((420, round(420 * bijin.height / bijin.width)), Image.LANCZOS).save(
    f'{OUT}/bijin.webp', quality=82, method=6)
print('bijin ok')

# The night canal for the loader: the moon, the blossom branch, the bridge and
# the water under it. Shown at 192 x 128, so 2x here.
canal = night.crop((300, 80, 1200, 680)).resize((384, 256), Image.LANCZOS)
canal.save(f'{OUT}/night-canal.webp', quality=82, method=6)
print('canal ok')
