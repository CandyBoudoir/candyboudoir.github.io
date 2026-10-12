#!/usr/bin/env bash
# Writes short demo clips from ffmpeg's built-in test patterns, so every run
# gets the same thumbnails without downloading any media.
# Usage: tests/stash/media.sh <library-dir>
set -euo pipefail

lib=$1
mkdir -p "$lib"
while read -r name pattern; do
  ffmpeg -nostdin -loglevel error -y \
    -f lavfi -i "${pattern}=size=640x360:rate=24" \
    -f lavfi -i "sine=frequency=440" \
    -t 8 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac \
    "$lib/$name.mp4"
done <<'CLIPS'
sugar-rush testsrc2
cherry-pop smptebars
sweet-tooth rgbtestsrc
lollipop-lane colorspectrum
bubblegum-sunday mandelbrot
velvet-hour pal100bars
midnight-fizz yuvtestsrc
crimson-candy smptehdbars
CLIPS
ls "$lib" | wc -l | xargs echo "clips:"
