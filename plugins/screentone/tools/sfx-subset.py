"""Screentone: the Dela Gothic One subset that holds the SFX lettering.

Dela Gothic One (SIL OFL 1.1) is a Japanese font of several megabytes, which
fontsource splits into numbered chunks by Unicode range. The theme letters
only a handful of kana and two kanji, so this keeps just those glyphs from the
three chunks that hold them and merges them into one WOFF2 of about 2 KB. The
CSS loads it under a unicode-range that lists the same characters
(src/css/00-fonts.css), and Dela's Latin comes from the fontsource package.

usage, from the repo root after pnpm install (needs fonttools with brotli):
  uvx --from 'fonttools[woff]==4.66.1' python -I plugins/screentone/tools/sfx-subset.py
"""
import os
import tempfile

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

# Every Japanese character the theme draws as text: ドキッ ジー ニヤ チュッ フン
# ゴゴゴ ドン 漫画, plus キラキラ and ぷい on the design-system page
TEXT = 'ドキッジーニヤチュフンゴ漫画ラぷい'
CHUNKS = (99, 117, 119)

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.normpath(os.path.join(HERE, '..'))
FILES = os.path.join(PLUGIN, '..', '..', 'node_modules', '@fontsource', 'dela-gothic-one', 'files')
OUT = os.path.join(PLUGIN, 'src', 'fonts', 'dela-gothic-one', 'dela-gothic-one-sfx-400-normal.woff2')

with tempfile.TemporaryDirectory() as tmp:
    parts = []
    for n in CHUNKS:
        # Keep the font's own timestamp, so every run writes the same bytes
        font = TTFont(os.path.join(FILES, f'dela-gothic-one-{n}-400-normal.woff2'), recalcTimestamp=False)
        options = subset.Options()
        options.flavor = None
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=TEXT)
        subsetter.subset(font)
        path = os.path.join(tmp, f'{n}.ttf')
        font.save(path)
        parts.append(path)
    merged = Merger().merge(parts)
    # The merger stamps the time it ran; take the font's own dates instead
    first = TTFont(parts[0])
    merged['head'].created = first['head'].created
    merged['head'].modified = first['head'].modified
    merged.recalcTimestamp = False
    merged.flavor = 'woff2'
    merged.save(OUT)

held = ''.join(chr(c) for c in sorted(TTFont(OUT).getBestCmap()))
missing = set(TEXT) - set(held)
if missing:
    raise SystemExit(f'missing from the subset: {"".join(sorted(missing))}')
print(f'{OUT}: {held} ({os.path.getsize(OUT)} bytes)')
