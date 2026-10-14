// @ts-check
import { defineConfig } from '@playwright/test'
import { STASH_BOX } from './tests/stash/stashbox-data.mjs'

// Compatibility tests against a running Stash (see tests/stash/). Each plugin
// keeps its own in plugins/<name>/tests/, with its screenshot baselines. Tests change
// Stash settings, so they run one at a time. The mock stash-box that
// prepare.mjs pointed Stash at starts with the tests.
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
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.STASH_URL ?? 'http://127.0.0.1:9999',
    viewport: { width: 1440, height: 900 },
    channel: process.env.PW_CHANNEL || undefined,
  },
})
