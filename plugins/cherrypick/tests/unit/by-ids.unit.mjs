import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordsByIds } from '../../src/js/data/byIds.js'

// A fake Stash's find by ids: like FindMany in v0.31.1, it fails the whole
// request if one id is gone, and counts the requests it answers.
function fakeFind(have) {
  const calls = []
  const fetch = async (ids) => {
    calls.push(ids)
    const gone = ids.find((id) => !have.includes(id))
    if (gone) throw new Error(`scene with id ${gone} not found`)
    return ids.map((id) => ({ id }))
  }
  return { fetch, calls }
}

test('every id there: one request', async () => {
  const { fetch, calls } = fakeFind(['1', '2', '3'])
  assert.deepEqual(await recordsByIds(fetch, ['3', '1']), [
    { id: '3' },
    { id: '1' },
  ])
  assert.equal(calls.length, 1)
})

test('one id gone: the others come back, in order', async () => {
  const { fetch, calls } = fakeFind(['1', '2', '3'])
  assert.deepEqual(await recordsByIds(fetch, ['3', '9', '1']), [
    { id: '3' },
    { id: '1' },
  ])
  // the batch, then one request per id
  assert.equal(calls.length, 4)
})

test('every id gone, or one id asked for and gone: the error', async () => {
  const { fetch } = fakeFind([])
  await assert.rejects(recordsByIds(fetch, ['8', '9']), /id 8 not found/)
  await assert.rejects(recordsByIds(fetch, ['9']), /id 9 not found/)
})

test('Stash down: the first error, after one try at each id', async () => {
  let n = 0
  const fetch = async () => {
    throw new Error(`down ${n++}`)
  }
  await assert.rejects(recordsByIds(fetch, ['1', '2']), /down 0/)
  assert.equal(n, 3)
})
