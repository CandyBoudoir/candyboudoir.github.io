import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capture } from './stickers.mjs'

// A page whose screenshot() fails with each error given, in turn, then
// returns a PNG; it counts its calls
function fakePage(errors) {
  const page = {
    shots: 0,
    frames: 0,
    async screenshot() {
      page.shots++
      const e = errors.shift()
      if (e) throw new Error(e)
      return Buffer.from('png')
    },
    async evaluate() {
      page.frames++
    },
  }
  return page
}

const REFUSED =
  'page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot'

test('a refused capture is tried again on the next frame', async () => {
  const page = fakePage([REFUSED, REFUSED])
  assert.equal(String(await capture(page)), 'png')
  assert.equal(page.shots, 3)
  assert.equal(page.frames, 2)
})

test('a capture refused three times fails', async () => {
  const page = fakePage([REFUSED, REFUSED, REFUSED])
  await assert.rejects(capture(page), /Unable to capture screenshot/)
  assert.equal(page.shots, 3)
})

test('any other error fails at once', async () => {
  const page = fakePage(['Target page, context or browser has been closed'])
  await assert.rejects(capture(page), /has been closed/)
  assert.equal(page.shots, 1)
})
