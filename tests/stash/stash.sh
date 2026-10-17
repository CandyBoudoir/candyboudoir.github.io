#!/usr/bin/env bash
# Downloads a Stash build, checks it against Stash's published SHA-1 sums and
# starts it on localhost with an empty config.
# Usage: tests/stash/stash.sh <vX.Y.Z|develop> <work-dir>
# STASH_PORT picks the port (default 9999). STASH_TZ starts Stash's server in
# that time zone (such as America/Phoenix) instead of the machine's.
set -euo pipefail

tag=$1
work=$2
port=${STASH_PORT:-9999}

case "$(uname -s)" in
  Linux) asset=stash-linux ;;
  Darwin) asset=stash-macos ;;
  *) echo "Unsupported OS" >&2; exit 1 ;;
esac
release=$tag
[ "$tag" = develop ] && release=latest_develop
base="https://github.com/stashapp/stash/releases/download/$release"

mkdir -p "$work/bin" "$work/config"
curl -fsSL -o "$work/bin/$asset" "$base/$asset"
curl -fsSL -o "$work/bin/CHECKSUMS_SHA1" "$base/CHECKSUMS_SHA1"
expected=$(awk -v a="$asset" '$2 == a { print $1 }' "$work/bin/CHECKSUMS_SHA1")
actual=$(shasum -a 1 "$work/bin/$asset" | awk '{ print $1 }')
[ -n "$expected" ] && [ "$expected" = "$actual" ] ||
  { echo "Checksum mismatch for $asset: expected '$expected', got '$actual'" >&2; exit 1; }
chmod +x "$work/bin/$asset"
"$work/bin/$asset" --version | tee "$work/version.txt"

if [ -n "${STASH_TZ:-}" ]; then export TZ=$STASH_TZ; fi
nohup "$work/bin/$asset" --config "$work/config/config.yml" \
  --host 127.0.0.1 --port "$port" --nobrowser > "$work/stash.log" 2>&1 &
echo $! > "$work/stash.pid"

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "http://127.0.0.1:$port/" && exit 0
  sleep 1
done
echo "Stash did not start" >&2
tail -50 "$work/stash.log" >&2
exit 1
