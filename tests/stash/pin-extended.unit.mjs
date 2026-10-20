import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXTENDED } from './companions.mjs'
import { rewriteExtended } from './pin-extended.mjs'

const source = readFileSync(join(import.meta.dirname, 'companions.mjs'), 'utf8')
const next = {
  version: '9.9.9',
  commit: 'a'.repeat(40),
  date: '2030-01-02 03:04:05',
}

test('rewriteExtended moves one entry and the version its comment names', () => {
  const { version, commit, date } = EXTENDED.stashui
  const text = rewriteExtended(source, 'stashui', next)
  const entry = text.slice(text.indexOf('  stashui: {'))
  assert.match(text, /^ {2}\/\/ Stash UI 9\.9\.9, a replacement interface/m)
  assert.match(entry, /^ {4}version: '9\.9\.9',$/m)
  assert.match(entry, /^ {4}commit: 'a{40}',$/m)
  assert.match(entry, /^ {4}date: '2030-01-02 03:04:05',$/m)
  for (const old of [`Stash UI ${version}`, commit, date])
    assert.ok(!text.includes(old), old)
  // Everything outside the entry and its comment stays
  const strip = (t) => t.replace(/ {2}\/\/ Stash UI [\s\S]*?\n {2}\},\n/, '')
  assert.equal(strip(text), strip(source))
})

test('rewriteExtended refuses a key EXTENDED does not have', () => {
  assert.throws(
    () => rewriteExtended(source, 'insights', next),
    /no EXTENDED\.insights/,
  )
})
