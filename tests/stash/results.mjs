// Tells one plugin's results from another's in a compatibility run. Each test
// step writes a Playwright JSON report to pw-results/<step>.json (PW_STEP in
// playwright.config.mjs), status.mjs turns it into an outcome per plugin
// folder for its leg, and gate.mjs and report.mjs read those outcomes.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The plugin folder a spec file belongs to. Report entries name files relative
// to the test directory (plugins/), errors by absolute path.
function folderOf(file = '') {
  return (file.match(/(?:^|\/)plugins\/([^/]+)\//) ??
    file.match(/^([^/]+)\//))?.[1]
}

// One step's outcome for each plugin folder, from its Playwright JSON report:
// 'failure' for a folder with a spec that did not pass (a flaky spec that
// passed on retry counts as passed) or a file that failed to load, 'success'
// otherwise. An error tied to no plugin's file, such as the mock stash-box
// failing to start, fails every folder.
export function pluginOutcomes(report, folders) {
  const failed = new Set()
  const walk = (suite) => {
    for (const spec of suite.specs ?? [])
      if (!spec.ok) failed.add(folderOf(spec.file))
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites ?? []) walk(suite)
  let all = false
  for (const error of report.errors ?? []) {
    const folder = folderOf(error.location?.file)
    if (folders.includes(folder)) failed.add(folder)
    else all = true
  }
  return Object.fromEntries(
    folders.map((f) => [f, all || failed.has(f) ? 'failure' : 'success']),
  )
}

// One step's outcome for each plugin folder, from the step's own outcome
// (success, failure, cancelled or skipped) and its report. A step that passed
// passed for every plugin; a failed step without a readable report failed for
// every plugin.
export function stepOutcomes(outcome, report, folders) {
  if (outcome === 'success' || outcome === 'skipped' || !outcome)
    return Object.fromEntries(folders.map((f) => [f, outcome || 'skipped']))
  if (!report) return Object.fromEntries(folders.map((f) => [f, 'failure']))
  return pluginOutcomes(report, folders)
}

// Whether a leg passed for one plugin: Stash set up and installed the
// plugins, the plugin's element checks passed and, on a stable leg, its
// screenshots too. It is the rule report.mjs applies to a whole leg.
export function pluginPasses(status, folder) {
  const own = status.plugins?.[folder]
  return (
    status.prepare === 'success' &&
    own?.contract === 'success' &&
    (status.channel !== 'stable' || own.visual === 'success')
  )
}

// The status-*.json files the test jobs upload, read from one folder.
export async function readStatuses(dir) {
  const statuses = []
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.json')))
    statuses.push(JSON.parse(await readFile(join(dir, f), 'utf8')))
  return statuses
}
