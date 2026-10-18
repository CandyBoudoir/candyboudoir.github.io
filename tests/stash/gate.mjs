// Writes gate.json for the run: for each plugin folder, whether it passed on
// every supported stable Stash (the stable legs) and which legs it failed.
// The report job uploads it as the run's gate artifact. A plugin's release
// waits only on its own entry, so one plugin failing holds back no other
// plugin's release. Reads the status-*.json files the test jobs upload; needs
// GITHUB_SHA and RUN_URL.
// Usage: node tests/stash/gate.mjs <status dir> > gate.json
import { pluginPasses, readStatuses } from './results.mjs'

const stable = (await readStatuses(process.argv[2] ?? 'status')).filter(
  (s) => s.channel === 'stable',
)
const folders = [
  ...new Set(stable.flatMap((s) => Object.keys(s.plugins ?? {}))),
].sort()
const plugins = Object.fromEntries(
  folders.map((f) => {
    const failing = stable.filter((s) => !pluginPasses(s, f)).map((s) => s.leg)
    return [f, { pass: !failing.length, failing }]
  }),
)
console.log(
  JSON.stringify(
    { sha: process.env.GITHUB_SHA, run: process.env.RUN_URL, plugins },
    null,
    2,
  ),
)
