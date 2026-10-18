#!/usr/bin/env bash
# Subsets Zen Maru Gothic (SIL OFL 1.1) to the Japanese characters City Pop
# draws, so the plugin ships a few kilobytes instead of the whole font. Run it
# again after adding a Japanese word to the theme: put its characters in TEXT.
# Needs curl and uv (it runs fonttools' pyftsubset through uvx).
# Usage: plugins/citypop/tools/zen-maru.sh
set -euo pipefail

# The google/fonts commit the source fonts come from
COMMIT=92503f07b74eab956c1abf4956fbf46170716caa
BASE="https://raw.githubusercontent.com/google/fonts/$COMMIT/ofl/zenmarugothic"

# シティポップ (city pop), 真夜中 (midnight), ラジオ (radio), 面 (side, as in
# A面 and B面) and 夕焼け (sunset glow)
TEXT='シティポップ真夜中ラジオ面夕焼け'

out="$(cd "$(dirname "$0")/.." && pwd)/src/fonts/zen-maru-gothic"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

for pair in Medium:500 Bold:700; do
  name=${pair%%:*}
  weight=${pair##*:}
  curl -fsSL -o "$tmp/$name.ttf" "$BASE/ZenMaruGothic-$name.ttf"
  uvx --from 'fonttools[woff]==4.60.1' pyftsubset "$tmp/$name.ttf" \
    --text="$TEXT" --layout-features='*' --flavor=woff2 \
    --no-hinting --desubroutinize \
    --output-file="$out/zen-maru-gothic-subset-$weight.woff2"
done
curl -fsSL -o "$out/OFL.txt" "$BASE/OFL.txt"
ls -l "$out"
