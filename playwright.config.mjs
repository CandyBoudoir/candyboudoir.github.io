// @ts-check
import { defineConfig } from '@playwright/test'
import { STASH_BOX } from './tests/stash/stashbox-data.mjs'

// Compatibility tests against a running Stash (see tests/stash/). Each plugin
// keeps its own in plugins/<name>/tests/, with its screenshot baselines. Tests change
// Stash settings, so they run one at a time. The mock stash-box that
// prepare.mjs pointed Stash at starts with the tests.
const step = process.env.PW_STEP

// One time for the mock ThePornDB's release dates (theporndb.mjs) across
// the run: the mock stash-box's own when one is already running and reused,
// or now. The mock stash-box and the workers start with this env, and the
// workers, loading this file again, keep it.
async function tpdbNow() {
  try {
    const res = await fetch(`${STASH_BOX}/tpdb/_now`)
    if (res.ok) return (await res.json()).now
  } catch {
    // None running: the run starts it
  }
  return new Date().toISOString()
}
process.env.TPDB_NOW ||= await tpdbNow()

export default defineConfig({
  testDir: 'plugins',
  timeout: 60_000,
  workers: 1,
  webServer: {
    command: 'node tests/stash/stashbox.mjs',
    url: `${STASH_BOX}/health`,
    reuseExistingServer: !process.env.CI,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/snapshots/{arg}{ext}',
  // PW_STEP (contract, visual) also writes a JSON report to
  // pw-results/<step>.json, which tests/stash/status.mjs reads to tell one
  // plugin's results from another's, and gives each step its own output
  // folder and HTML report, since Playwright empties both at the start of a
  // run and the screenshot step would delete the element checks' traces.
  outputDir: step ? `test-results/${step}` : 'test-results',
  reporter: [
    ['list'],
    ...(process.env.CI
      ? [
          [
            'html',
            {
              open: 'never',
              outputFolder: step
                ? `playwright-report/${step}`
                : 'playwright-report',
            },
          ],
        ]
      : []),
    ...(step ? [['json', { outputFile: `pw-results/${step}.json` }]] : []),
  ],
  use: {
    baseURL: process.env.STASH_URL ?? 'http://127.0.0.1:9999',
    viewport: { width: 1440, height: 900 },
    channel: process.env.PW_CHANNEL || undefined,
    // BROWSER=firefox or webkit runs the same specs in another engine.
    browserName: /** @type {any} */ (process.env.BROWSER) || 'chromium',
  },
})
