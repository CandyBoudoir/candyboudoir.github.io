#!/usr/bin/env bash
# Copies built plugins into a Stash plugins folder over SSH, then reloads
# plugins so Stash picks them up. Name the plugins to deploy by folder:
#   pnpm deploy:local juicy
# Settings come from the environment (a gitignored .envrc works well):
#   STASH_URL           Stash's address, e.g. http://localhost:9999
#   STASH_SSH_HOST      SSH host holding Stash's plugins folder
#   STASH_PLUGINS_DIR   the folder on that host that holds the installed
#                       plugins, e.g. /root/.stash/plugins/candyboudoir
#   STASH_API_KEY_FILE  file holding a Stash API key (optional if Stash has no login)
# Each plugin goes to $STASH_PLUGINS_DIR/<plugin ID>, over the copy Stash
# installed from the plugin source, since a second folder with the same plugin
# ID would clash. Stash's package manifest is kept, so the next update from the
# source puts the released version back.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${STASH_URL:?Set STASH_URL}"
: "${STASH_SSH_HOST:?Set STASH_SSH_HOST}"
: "${STASH_PLUGINS_DIR:?Set STASH_PLUGINS_DIR}"
[ $# -gt 0 ] || { echo "Name the plugins to deploy, e.g. pnpm deploy:local juicy" >&2; exit 1; }
[ -f dist/entries.json ] || { echo "Run pnpm build first" >&2; exit 1; }

for name in "$@"; do
  id=$(node -e 'const e = require("./dist/entries.json").find((e) => e.folder === process.argv[1]); if (!e) process.exit(1); console.log(e.id)' "$name") ||
    { echo "No built plugin in plugins/$name" >&2; exit 1; }
  ssh "$STASH_SSH_HOST" "mkdir -p '$STASH_PLUGINS_DIR/$id'"
  rsync -a --delete --exclude manifest "dist/site/$id/" "$STASH_SSH_HOST:$STASH_PLUGINS_DIR/$id/"
  echo "Deployed $id"
done

auth=()
if [ -n "${STASH_API_KEY_FILE:-}" ]; then
  auth=(-H "ApiKey: $(cat "$STASH_API_KEY_FILE")")
fi
curl -fsS "$STASH_URL/graphql" ${auth[@]+"${auth[@]}"} \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { reloadPlugins }"}' >/dev/null

echo "Reloaded plugins. Refresh Stash to see them; a new plugin starts enabled (Settings > Plugins to turn it off)."

case " $* " in
  *" cherrypick "*) echo "Check Cherry Pick on this Stash with pnpm smoke." ;;
esac
