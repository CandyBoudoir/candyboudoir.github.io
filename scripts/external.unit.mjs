import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { latestTag, listExternal } from './external.mjs'
import { assetDigest, assetURL, isAssetURL } from './release-assets.mjs'

// A folder laid out like this repo, with one plugin of its own and the given
// plugins.external.json
function base(external) {
  const dir = mkdtempSync(join(tmpdir(), 'external-'))
  mkdirSync(join(dir, 'plugins', 'juicy'), { recursive: true })
  writeFileSync(
    join(dir, 'plugins', 'juicy', 'plugin.mjs'),
    "export const id = 'Theme-Juicy'\n",
  )
  writeFileSync(join(dir, 'plugins.external.json'), JSON.stringify(external))
  return dir
}

const cherrypick = {
  repo: 'CandyBoudoir/cherrypick',
  folder: 'cherrypick',
  title: 'Cherry Pick',
  summary: 'Learns what you like.',
}

test('the list takes CandyBoudoir repos whose folders are not kept here', async () => {
  assert.deepEqual(await listExternal(base([cherrypick])), [cherrypick])
  assert.deepEqual(await listExternal(base([])), [])
})

test('the list refuses other owners, folders kept here, repeats and missing text', async () => {
  const refused = [
    [{ ...cherrypick, repo: 'someone/cherrypick' }],
    [{ ...cherrypick, folder: 'juicy' }],
    [cherrypick, cherrypick],
    [{ ...cherrypick, summary: '' }],
    [{ ...cherrypick, folder: '../escape' }],
  ]
  for (const list of refused)
    await assert.rejects(listExternal(base(list)), /plugins\.external\.json/)
})

test('the tag is the latest release reachable from HEAD unless one is pinned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tags-'))
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@example.com',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'tag.gpgsign=false',
        ...args,
      ],
      { cwd: dir },
    )
  git('init', '--quiet', '--initial-branch=main')
  for (const version of ['0.1.9', '0.1.10']) {
    git('commit', '--quiet', '--allow-empty', '-m', version)
    git('tag', `cherrypick-v${version}`)
  }
  git('tag', 'juicy-v9.9.9')
  // A tag on a branch HEAD does not reach stays out
  git('checkout', '--quiet', '-b', 'side')
  git('commit', '--quiet', '--allow-empty', '-m', 'side')
  git('tag', 'cherrypick-v0.2.0')
  git('checkout', '--quiet', 'main')

  assert.equal(latestTag(dir, 'cherrypick'), 'cherrypick-v0.1.10')
  assert.equal(
    latestTag(dir, 'cherrypick', ['juicy-v0.3.2', 'cherrypick-v0.1.9']),
    'cherrypick-v0.1.9',
  )
  assert.equal(latestTag(dir, 'leather'), undefined)
})

test("an external plugin's zip and digest come from its own repo", async () => {
  const url = assetURL(
    'cherrypick-v0.1.7',
    'CherryPick.zip',
    'CandyBoudoir/cherrypick',
  )
  assert.equal(
    url,
    'https://github.com/CandyBoudoir/cherrypick/releases/download/cherrypick-v0.1.7/CherryPick.zip',
  )
  assert.equal(
    assetURL('juicy-v0.4.0', 'Theme-Juicy.zip'),
    'https://github.com/CandyBoudoir/candyboudoir.github.io/releases/download/juicy-v0.4.0/Theme-Juicy.zip',
  )
  assert.ok(isAssetURL(url))
  assert.ok(!isAssetURL('Theme-Juicy.zip'))

  const real = globalThis.fetch
  const asked = []
  globalThis.fetch = async (u) => {
    asked.push(u)
    return Response.json({
      assets: [{ name: 'CherryPick.zip', digest: 'sha256:abc123' }],
    })
  }
  try {
    assert.equal(await assetDigest(url), 'abc123')
  } finally {
    globalThis.fetch = real
  }
  assert.deepEqual(asked, [
    'https://api.github.com/repos/CandyBoudoir/cherrypick/releases/tags/cherrypick-v0.1.7',
  ])
})
