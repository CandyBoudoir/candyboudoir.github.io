// Tag Candy's pure parts: name keys, the build-time index, the match order,
// ownership by time and the addresses it hands Stash.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex } from '../../lookup.mjs'
import { matchTag, normalize, parseExtraMatches } from '../../src/match.js'
import { FIELD, ownership, parseStamp, stamp } from '../../src/owner.js'
import {
  explicitName,
  explicitUrl,
  iconUrls,
  redact,
  selfBase,
  withKey,
} from '../../src/urls.js'
import { readBundle } from '../../plugin.mjs'

const SDB = 'https://stashdb.org/graphql'
const bundle = {
  format: 1,
  keywords: [],
  stashdb_none: ['id-none'],
  concepts: [
    {
      name: 'Stockings / Hosiery',
      icon: 'stockings-0a1b2c3d.webp',
      nude: false,
      tags: ['Nylons', 'Stockings & Garters'],
      stashdb: [{ id: 'id-stockings', name: 'Stockings', aliases: ['Hose'] }],
    },
    {
      name: 'Chastity',
      icon: 'chastity-1a2b3c4d.webp',
      nude: true,
      tags: ['Chastity'],
      stashdb: [
        { id: 'id-chastity', name: 'Chastity Device', aliases: ['Cage'] },
      ],
    },
    {
      name: 'Cage Fantasy',
      icon: null,
      nude: false,
      tags: [],
      stashdb: [{ id: 'id-cage', name: 'Caged', aliases: ['Cage'] }],
    },
  ],
}
const index = buildIndex(bundle)
const tag = (name, aliases = [], ids = []) => ({
  name,
  aliases,
  stash_ids: ids.map((stash_id) => ({ endpoint: SDB, stash_id })),
})

test('normalize folds case, ampersands, accents and punctuation', () => {
  assert.equal(normalize('Stockings & Garters'), 'stockingsandgarters')
  assert.equal(normalize('stockings and garters'), 'stockingsandgarters')
  assert.equal(normalize('Ménage à Trois'), 'menageatrois')
  assert.equal(normalize('  POV / Close-up! '), 'povcloseup')
  assert.equal(normalize('日本'), '')
})

test('the index puts library names first and drops shared StashDB names', () => {
  assert.equal(index.names.nylons, 0)
  assert.equal(index.names.stockings, 0)
  assert.equal(index.names.hose, 0)
  assert.equal(index.names.chastitydevice, 1)
  assert.equal(index.names.cage, undefined)
  assert.deepEqual(index.ambiguous, ['cage'])
  assert.equal(index.stashdb['id-none'], -1)
  assert.equal(index.concepts[1].x, true)
})

test('a library name that two concepts claim stops the build', () => {
  const bad = structuredClone(bundle)
  bad.concepts[1].tags.push('NYLONS')
  assert.throws(() => buildIndex(bad), /share the key/)
})

test('matching runs Extra matches, then StashDB, then name, then aliases', () => {
  const extra = parseExtraMatches('Cage=Chastity; Nope=Unknown', index)
  assert.deepEqual(extra.unknown, ['Unknown'])
  assert.deepEqual(matchTag(tag('Cage'), index, extra.pairs), {
    concept: 1,
    via: 'extra',
  })
  // A StashDB link decides the tag, whatever its name or aliases say.
  assert.deepEqual(matchTag(tag('Nylons', [], ['id-cage']), index), {
    concept: 2,
    via: 'stashdb',
  })
  assert.deepEqual(matchTag(tag('Anything', ['Nylons'], ['id-none']), index), {
    concept: -1,
    via: 'stashdb',
  })
  // A StashDB ID the review has not seen falls through to names.
  assert.deepEqual(matchTag(tag('nylons', [], ['id-new']), index), {
    concept: 0,
    via: 'name',
  })
  assert.deepEqual(matchTag(tag('Legwear', ['Hose']), index), {
    concept: 0,
    via: 'alias',
  })
  assert.deepEqual(matchTag(tag('Cage'), index), { concept: null, via: 'none' })
  // StashIDs from other stash-boxes do not count.
  const other = {
    name: 'Legwear',
    stash_ids: [
      { endpoint: 'https://example.org/graphql', stash_id: 'id-cage' },
    ],
  }
  assert.equal(matchTag(other, index).concept, null)
})

test('ownership follows the stamp written with the image', () => {
  const at = Date.parse('2026-10-17T12:00:00.700Z')
  const fields = { [FIELD]: stamp('a-0a1b2c3d.webp', at) }
  const image = '/tag/1/image?t=1'
  const own = (updated, f = fields, path = image) =>
    ownership({ image_path: path, updated_at: updated, custom_fields: f }).state
  // Stash keeps updated_at to the second, so the same second counts.
  assert.equal(own('2026-10-17T12:00:00Z'), 'mine')
  assert.equal(own('2026-10-17T08:00:02-04:00'), 'mine')
  assert.equal(own('2026-10-17T12:00:03Z'), 'theirs')
  assert.equal(own('2026-10-17T11:59:59Z'), 'theirs')
  assert.equal(own('2026-10-17T12:00:00Z', {}), 'theirs')
  assert.equal(
    own('2026-10-17T12:00:00Z', {}, '/tag/1/image?t=1&default=true'),
    'empty',
  )
  assert.equal(
    own('2026-10-17T12:05:00Z', fields, '/tag/1/image?t=1&default=true'),
    'removed',
  )
  assert.deepEqual(parseStamp('a|b|12'), { icon: 'a|b', at: 12 })
  assert.equal(parseStamp('nonsense'), null)
})

test('addresses for icons, this Stash and explicit icons', () => {
  assert.deepEqual(iconUrls('a-0a1b2c3d.webp'), [
    'https://candyboudoir.github.io/tagcandy/icons/a-0a1b2c3d.webp',
    'https://candyboudoir.github.io/develop/tagcandy/icons/a-0a1b2c3d.webp',
  ])
  assert.deepEqual(iconUrls('a.webp', 'http://127.0.0.1:8000/icons'), [
    'http://127.0.0.1:8000/icons/a.webp',
  ])
  assert.equal(
    selfBase({ Scheme: 'http', Host: '0.0.0.0', Port: 9999 }),
    'http://127.0.0.1:9999',
  )
  assert.equal(
    selfBase({ Scheme: 'https', Host: '::', Port: 443 }),
    'https://[::1]:443',
  )
  assert.equal(
    selfBase({ Scheme: 'http', Host: 'fd00::5', Port: 1 }),
    'http://[fd00::5]:1',
  )
  assert.equal(
    selfBase({ Scheme: 'http', Host: '192.168.1.5', Port: 9999 }),
    'http://192.168.1.5:9999',
  )
  assert.equal(withKey('http://x/a', 'k=1'), 'http://x/a?apikey=k%3D1')
  assert.equal(withKey('http://x/a?t=1', ''), 'http://x/a?t=1')
  assert.equal(explicitName('chastity-1a2b3c4d.webp'), 'chastity.webp')
  assert.equal(
    explicitUrl(
      '/custom/explicit',
      'chastity-1a2b3c4d.webp',
      'http://127.0.0.1:9999',
      'KEY',
    ),
    'http://127.0.0.1:9999/custom/explicit/chastity.webp?apikey=KEY',
  )
  assert.equal(
    explicitUrl('https://example.org/x/', 'chastity-1a2b3c4d.webp', '', 'KEY'),
    'https://example.org/x/chastity.webp',
  )
  assert.equal(explicitUrl('  ', 'a.webp', '', ''), null)
  assert.equal(
    redact('get http://h/?apikey=abc: 404 abc', 'abc'),
    'get http://h/?apikey=<api key>: 404 <api key>',
  )
})

test('the shipped bundle builds and every icon it names exists', async () => {
  const { readdir } = await import('node:fs/promises')
  const real = await readBundle()
  const built = buildIndex(real)
  assert.ok(built.concepts.length > 100)
  const files = new Set(await readdir(new URL('../../icons/', import.meta.url)))
  for (const c of real.concepts)
    if (c.icon) assert.ok(files.has(c.icon), `${c.icon} is missing from icons/`)
})
