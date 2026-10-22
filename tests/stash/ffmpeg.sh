#!/usr/bin/env bash
# Puts ffmpeg and ffprobe for Linux x86-64 in <dir>/bin, from zips checked
# against pinned SHA-256 sums: the static 6.1 build Stash itself downloads
# when it has none (ffbinaries v6.1, built by johnvansickle.com, with libx264).
# Ubuntu's ffmpeg is 99 packages from an apt mirror that sometimes serves
# 40 kB/s, which ran Compatibility legs into their 30-minute limit. Zips
# already in <dir> (the workflow caches them) are checked and reused.
# Usage: tests/stash/ffmpeg.sh <dir>
set -euo pipefail

dir=$1
base=https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1

mkdir -p "$dir/bin"
while read -r sum name; do
  zip="$dir/$name-6.1-linux-64.zip"
  [ -f "$zip" ] || curl -fsSL --retry 3 -o "$zip" "$base/$name-6.1-linux-64.zip"
  actual=$(shasum -a 256 "$zip" | awk '{ print $1 }')
  [ "$sum" = "$actual" ] ||
    { echo "Checksum mismatch for $name: expected '$sum', got '$actual'" >&2; exit 1; }
  unzip -o -q "$zip" -d "$dir/bin"
done <<'SUMS'
8bb4a27f5fd02f3dd9a5e75c9eddf6ace1d50a08929ee0d20bbf17eb467fb711 ffmpeg
cb690c360042b51d9e901db2b0185c585330c1067b5c5edf0b6a5e26e0375e2a ffprobe
SUMS
"$dir/bin/ffmpeg" -version | head -1
"$dir/bin/ffprobe" -version | head -1
