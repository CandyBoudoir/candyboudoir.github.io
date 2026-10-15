import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDb } from '../../src/js/model/db.js'
import { createEngine } from '../../src/js/model/index.js'
import { syntheticLibrary, syntheticStashdb } from './fixtures/synthetic.mjs'

// Issue #24: the fit for a 10,000-scene library finishes in under two
// seconds. compute() on a fresh engine fits seven times (two models and five
// holdout folds) and predicts every scene.
const LIMIT_MS = 2000

const { input } = syntheticLibrary({ scenes: 10000 })
input.stashdb = syntheticStashdb(input, { missing: 400 })
const time = (fn) => {
  const t0 = performance.now()
  const out = fn()
  return [out, performance.now() - t0]
}
const ms = (x) => `${x.toFixed(0)} ms`

test('a 10,000-scene library: fit and compute in under two seconds', (t) => {
  const [db, msDb] = time(() => buildDb(input))
  // the first compute on a new library: nothing worked out yet
  const [M, msCompute] = time(() => createEngine(db).compute({}))
  // the seven fits alone, on a new engine
  const [F, msFit] = time(() => createEngine(db).fits({}, new Set()))
  t.diagnostic(
    `buildDb ${ms(msDb)}, compute ${ms(msCompute)}, fits ${ms(msFit)}`,
  )
  assert.equal(db.owned.length, 10000)
  assert.equal(F.rated.length, 6000)
  assert.ok(M.gate, 'the model still beats your average')
  assert.ok(msFit < LIMIT_MS, `fits took ${ms(msFit)}`)
  assert.ok(msCompute < LIMIT_MS, `compute took ${ms(msCompute)}`)
})
