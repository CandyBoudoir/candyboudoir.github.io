#!/usr/bin/env bash
# Copies the built plugin into a Stash plugins folder over SSH, then reloads
# plugins so Stash picks it up. Settings come from the environment (a
# gitignored .envrc works well):
#   STASH_URL           Stash's address, e.g. http://localhost:9999
#   STASH_SSH_HOST      SSH host holding Stash's plugins folder
#   STASH_PLUGIN_DIR    destination folder on that host, e.g.
#                       /root/.stash/plugins/juicy-dev/Theme-Juicy
#   STASH_API_KEY_FILE  file holding a Stash API key (optional if Stash has no login)
# Keep the folder apart from installed sources so Stash's package manager leaves it alone.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=dist/site/Theme-Juicy/

: "${STASH_URL:?Set STASH_URL}"
: "${STASH_SSH_HOST:?Set STASH_SSH_HOST}"
: "${STASH_PLUGIN_DIR:?Set STASH_PLUGIN_DIR}"

[ -d "$SRC" ] || { echo "Run pnpm build first" >&2; exit 1; }

ssh "$STASH_SSH_HOST" "mkdir -p '$STASH_PLUGIN_DIR'"
rsync -a --delete "$SRC" "$STASH_SSH_HOST:$STASH_PLUGIN_DIR/"

auth=()
if [ -n "${STASH_API_KEY_FILE:-}" ]; then
  auth=(-H "ApiKey: $(cat "$STASH_API_KEY_FILE")")
fi
curl -fsS "$STASH_URL/graphql" ${auth[@]+"${auth[@]}"} \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { reloadPlugins }"}' >/dev/null

echo "Deployed and reloaded plugins. Refresh Stash to see it; a new plugin starts enabled (Settings > Plugins to turn it off)."
