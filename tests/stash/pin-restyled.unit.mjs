import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESTYLED } from './companions.mjs'
import { moveTestedBeside, moveVersion, rewritePin } from './pin-restyled.mjs'

const source = readFileSync(join(import.meta.dirname, 'companions.mjs'), 'utf8')
const next = {
  version: '9.9.9',
  commit: 'a'.repeat(40),
  files: { 'Insights.js': 'b'.repeat(64), 'Insights.yml': 'c'.repeat(64) },
}

test('rewritePin moves one entry, its comment and its commit constant', () => {
  const { version } = RESTYLED.insights
  const text = rewritePin(source, 'insights', next)
  const entry = text.slice(text.indexOf('  insights: {'))
  assert.match(text, /^const INSIGHTS_COMMIT = 'a{40}'$/m)
  assert.match(text, /^ {2}\/\/ Insights 9\.9\.9, a stats dashboard/m)
  assert.match(entry, /^ {4}version: '9\.9\.9',$/m)
  assert.match(
    entry,
    / {4}files: \{\n {6}'Insights\.js':\n {8}'b{64}',\n {6}'Insights\.yml':\n {8}'c{64}',\n {4}\},/,
  )
  assert.doesNotMatch(entry.slice(0, entry.indexOf('\n  },')), /Insights\.css/)
  assert.ok(!text.includes(`Insights ${version}`))
  // Everything outside the entry, its comment and the constant stays
  const strip = (t) =>
    t
      .replace(/^const INSIGHTS_COMMIT = .*$/m, '')
      .replace(/ {2}\/\/ Insights [\s\S]*?\n {2}\},\n/, '')
  assert.equal(strip(text), strip(source))
})

test('rewritePin leaves the other plugins alone', () => {
  const text = rewritePin(source, 'performerstoolkit', next)
  assert.match(text, /^const PERFORMERS_TOOLKIT_COMMIT = 'a{40}'$/m)
  assert.ok(
    text.includes(`const INSIGHTS_COMMIT = '${RESTYLED.insights.commit}'`),
  )
  assert.ok(text.includes(`version: '${RESTYLED.insights.version}'`))
})

test('rewritePin refuses a plugin it has no entry for', () => {
  assert.throws(() => rewritePin(source, 'nope', next), /no RESTYLED\.nope/)
})

test('moveVersion moves every mention of that plugin only', () => {
  assert.equal(
    moveVersion(
      'Tested with Insights 2.1.0 and Performers Toolkit 2.1.0. Insights 2.1.0 again.',
      'Insights',
      '2.1.0',
      '2.2.0',
    ),
    'Tested with Insights 2.2.0 and Performers Toolkit 2.1.0. Insights 2.2.0 again.',
  )
})

test('moveTestedBeside moves only the pending section', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 0.6.0',
    '',
    '- Insights 2.1.0 renamed a class.',
    '- Tested beside Insights 2.1.0 and Performers Toolkit 0.4.2.',
    '',
    '## 0.5.0',
    '',
    '- Tested beside Insights 2.1.0 and Performers Toolkit 0.4.2.',
    '',
  ].join('\n')
  assert.equal(
    moveTestedBeside(changelog, '0.6.0', 'Insights', '2.1.0', '2.2.0'),
    changelog.replace(
      '- Tested beside Insights 2.1.0',
      '- Tested beside Insights 2.2.0',
    ),
  )
  assert.equal(
    moveTestedBeside(changelog, '0.7.0', 'Insights', '2.1.0', '2.2.0'),
    changelog,
  )
})
