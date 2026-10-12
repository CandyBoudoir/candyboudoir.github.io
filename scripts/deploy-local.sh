#!/usr/bin/env bash
# Copies the built plugin into a Stash plugins folder over SSH, then reloads
# plugins so Stash picks it up. Settings come from the environment (a
# gitignored .envrc works well):
#   STASH_URL           Stash's address, e.g. http://localhost:9999
#   STASH_SSH_HOST      SSH host holding Stash's plugins folder
#   STASH_PLUGIN_DIR    the installed plugin's folder on that host, e.g.
#                       /root/.stash/plugins/juicy/Theme-Juicy
#   STASH_API_KEY_FILE  file holding a Stash API key (optional if Stash has no login)
# It deploys over the copy Stash installed from the plugin source, since a second
# folder with the same plugin ID would clash. Stash's package manifest is kept, so
# the next update from the source puts the released version back.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=dist/site/Theme-Juicy/

: "${STASH_URL:?Set STASH_URL}"
: "${STASH_SSH_HOST:?Set STASH_SSH_HOST}"
: "${STASH_PLUGIN_DIR:?Set STASH_PLUGIN_DIR}"

[ -d "$SRC" ] || { echo "Run pnpm build first" >&2; exit 1; }

ssh "$STASH_SSH_HOST" "mkdir -p '$STASH_PLUGIN_DIR'"
rsync -a --delete --exclude manifest "$SRC" "$STASH_SSH_HOST:$STASH_PLUGIN_DIR/"

auth=()
if [ -n "${STASH_API_KEY_FILE:-}" ]; then
  auth=(-H "ApiKey: $(cat "$STASH_API_KEY_FILE")")
fi
curl -fsS "$STASH_URL/graphql" ${auth[@]+"${auth[@]}"} \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { reloadPlugins }"}' >/dev/null

echo "Deployed and reloaded plugins. Refresh Stash to see it; a new plugin starts enabled (Settings > Plugins to turn it off)."
