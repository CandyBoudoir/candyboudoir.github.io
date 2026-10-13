// @ts-check
import { defineConfig } from '@playwright/test'
import { STASH_BOX } from './tests/stash/stashbox-data.mjs'

// Compatibility tests against a running Stash (see tests/stash/). Tests change
// Stash settings, so they run one at a time. The mock stash-box that
// prepare.mjs pointed Stash at starts with the tests.
export default defineConfig({
  testDir: 'tests/e2e',
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
  snapshotPathTemplate: 'tests/e2e/snapshots/{arg}{ext}',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.STASH_URL ?? 'http://127.0.0.1:9999',
    viewport: { width: 1440, height: 900 },
    channel: process.env.PW_CHANNEL || undefined,
  },
})
