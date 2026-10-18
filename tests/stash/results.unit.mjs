import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pluginOutcomes, pluginPasses, stepOutcomes } from './results.mjs'

const folders = ['cherrypick', 'juicy', 'leather']

// The shape of Playwright's JSON report: a suite per file, describe blocks
// as nested suites, specs with ok and file relative to the test directory
const spec = (file, ok) => ({ title: 't', ok, file, tests: [] })
const report = (specs, errors = []) => ({
  suites: [
    {
      title: 'juicy/tests/contract.spec.mjs',
      file: 'juicy/tests/contract.spec.mjs',
      specs: specs.filter((s) => s.file.startsWith('juicy/')),
      suites: [],
    },
    {
      title: 'cherrypick/tests/themes.contract.spec.mjs',
      file: 'cherrypick/tests/themes.contract.spec.mjs',
      specs: [],
      suites: [
        {
          title: 'a describe block',
          file: 'cherrypick/tests/themes.contract.spec.mjs',
          specs: specs.filter((s) => s.file.startsWith('cherrypick/')),
          suites: [],
        },
      ],
    },
  ],
  errors,
})

test('a failing spec fails only its own plugin, nested suites included', () => {
  assert.deepEqual(
    pluginOutcomes(
      report([
        spec('juicy/tests/contract.spec.mjs', true),
        spec('cherrypick/tests/themes.contract.spec.mjs', false),
      ]),
      folders,
    ),
    { cherrypick: 'failure', juicy: 'success', leather: 'success' },
  )
})

test('a file that fails to load fails its plugin; an error with no file fails all', () => {
  const loadError = {
    message: 'SyntaxError',
    location: {
      file: '/home/runner/work/repo/repo/plugins/leather/tests/contract.spec.mjs',
      line: 3,
      column: 1,
    },
  }
  assert.deepEqual(pluginOutcomes(report([], [loadError]), folders), {
    cherrypick: 'success',
    juicy: 'success',
    leather: 'failure',
  })
  assert.deepEqual(
    pluginOutcomes(report([], [{ message: 'webServer exited' }]), folders),
    { cherrypick: 'failure', juicy: 'failure', leather: 'failure' },
  )
})

test("a step's own outcome decides when it passed, was skipped or left no report", () => {
  const failing = report([spec('juicy/tests/contract.spec.mjs', false)])
  assert.deepEqual(stepOutcomes('success', failing, ['juicy']), {
    juicy: 'success',
  })
  assert.deepEqual(stepOutcomes('skipped', null, ['juicy']), {
    juicy: 'skipped',
  })
  assert.deepEqual(stepOutcomes('', null, ['juicy']), { juicy: 'skipped' })
  assert.deepEqual(stepOutcomes('failure', null, folders), {
    cherrypick: 'failure',
    juicy: 'failure',
    leather: 'failure',
  })
  assert.deepEqual(stepOutcomes('failure', failing, folders), {
    cherrypick: 'success',
    juicy: 'failure',
    leather: 'success',
  })
})

const leg = (channel, prepare, plugins) => ({
  leg: channel === 'stable' ? 'v0.31.1' : channel,
  channel,
  prepare,
  plugins,
})

test('a stable leg needs the screenshots too; other channels need the elements only', () => {
  const own = { juicy: { contract: 'success', visual: 'failure' } }
  assert.equal(pluginPasses(leg('stable', 'success', own), 'juicy'), false)
  assert.equal(pluginPasses(leg('develop', 'success', own), 'juicy'), true)
  assert.equal(pluginPasses(leg('develop', 'failure', own), 'juicy'), false)
  assert.equal(pluginPasses(leg('stable', 'success', {}), 'juicy'), false)
})

test('gate.mjs passes a plugin only when every stable leg passed it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'))
  const ok = { contract: 'success', visual: 'success' }
  const write = (name, status) =>
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(status))
  write('v0.31.1', {
    ...leg('stable', 'success', {
      cherrypick: ok,
      juicy: { contract: 'failure', visual: 'success' },
    }),
  })
  write('v0.30.0', {
    ...leg('stable', 'success', { cherrypick: ok, juicy: ok }),
    leg: 'v0.30.0',
  })
  // Develop never gates a release
  write('develop', leg('develop', 'failure', {}))
  const gate = JSON.parse(
    execFileSync('node', [new URL('gate.mjs', import.meta.url).pathname, dir], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_SHA: 'abc', RUN_URL: 'https://run' },
    }),
  )
  assert.deepEqual(gate, {
    sha: 'abc',
    run: 'https://run',
    plugins: {
      cherrypick: { pass: true, failing: [] },
      juicy: { pass: false, failing: ['v0.31.1'] },
    },
  })
})
