// Checks Tag Candy in Stash, on a Stash of its own (tests/stash.mjs): the dry
// run, matching by StashDB link, name and alias with Extra matches first, the
// icon bytes Stash downloads, people's own images kept by default, a removed
// icon left removed, an edited tag's icon counted as the person's, older
// icons updated, the hooks, Remove Tag Candy icons, WebP on Stash's pages, an
// unreachable icon address, the API key on a Stash with a password, backups
// and Restore, explicit icons by web address and by a path on this Stash, and
// no API key in the log.
import { expect, test } from '@playwright/test'
import { join } from 'node:path'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { buildScript, readBundle } from '../plugin.mjs'
import {
  EXPLICIT_DIR,
  ICONS,
  PLUGIN,
  TC,
  allLogs,
  available,
  createTag,
  dataUri,
  findByName,
  findTag,
  gql,
  iconBytes,
  imageHash,
  installScript,
  lock,
  runTask,
  settings,
  setUp,
  sha256,
  tearDown,
  updateTag,
} from './stash.mjs'

test.describe.configure({ mode: 'serial' })
test.skip(!available(), 'needs the Stash binary tests/stash/stash.sh downloads')

const SDB = 'https://stashdb.org/graphql'
// A person's own image: a 1 x 1 red PNG.
const OWN = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
)
const OWN_HASH = sha256(OWN)

let bundle
let named
let iconHash
let apiKey = ''
const pick = () => named.shift()
const hooks = (on) => settings({ leaveNewTagsAlone: !on })
// An edit inside the two seconds after Tag Candy's update still counts as
// Tag Candy's (src/owner.js), so a person's edits wait that long out.
const outsideWindow = () => new Promise((r) => setTimeout(r, 3000))

test.beforeAll(async () => {
  test.setTimeout(180_000)
  bundle = await readBundle()
  named = bundle.concepts.filter((c) => c.icon && c.tags.length)
  iconHash = async (concept) => sha256(await iconBytes(concept.icon))
  await setUp()
  await hooks(false)
})
test.afterAll(tearDown)

const state = {}

test('a dry run reports every match and changes nothing', async () => {
  const [a, c, d] = [pick(), pick(), pick()]
  state.exact = { ...(await createTag({ name: a.tags[0] })), concept: a }
  state.variant = {
    ...(await createTag({ name: `${c.tags[0].toUpperCase()} !` })),
    concept: c,
  }
  state.alias = {
    ...(await createTag({ name: 'Zz alias holder', aliases: [d.tags[0]] })),
    concept: d,
  }
  state.none = await createTag({ name: 'Zz nothing matches this' })

  const log = await runTask('Dry run')
  for (const t of [state.exact, state.variant, state.alias, state.none])
    expect(await imageHash(t.id)).toBeNull()
  expect(log.join('\n')).toContain(
    'Dry run: Tag Candy would give 3 tags an icon',
  )
  expect(log.join('\n')).toContain('Matched nothing: Zz nothing matches this')
})

test('StashDB links decide a tag, and Extra matches beat them', async () => {
  const b = bundle.concepts.find((c) => c.icon && c.stashdb.length)
  const dark = bundle.concepts.find((c) => !c.icon && c.stashdb.length)
  const f = pick()
  state.linked = {
    ...(await createTag({
      name: 'Zz linked tag',
      stash_ids: [{ endpoint: SDB, stash_id: b.stashdb[0].id }],
    })),
    concept: b,
  }
  // Its name matches a concept, but its StashDB tag has no icon yet.
  const e = pick()
  state.dark = await createTag({
    name: e.tags[0],
    stash_ids: [{ endpoint: SDB, stash_id: dark.stashdb[0].id }],
  })
  state.extra = {
    ...(await createTag({
      name: 'Zz extra match',
      stash_ids: [{ endpoint: SDB, stash_id: b.stashdb[0].id }],
    })),
    concept: f,
  }
  await settings({
    leaveNewTagsAlone: true,
    extraMatches: `Zz extra match=${f.name}`,
  })

  await runTask('Apply icons')
  for (const t of [
    state.exact,
    state.variant,
    state.alias,
    state.linked,
    state.extra,
  ])
    expect(await imageHash(t.id), t.name).toBe(await iconHash(t.concept))
  expect(await imageHash(state.dark.id)).toBeNull()
  expect(await imageHash(state.none.id)).toBeNull()
  const tag = await findTag(state.exact.id)
  expect(tag.custom_fields.tag_candy).toMatch(
    new RegExp(`^${state.exact.concept.icon.replace('.', '\\.')}\\|\\d+$`),
  )
})

test('by default Apply keeps the images people set, and says how to swap them', async () => {
  const g = pick()
  const h = pick()
  state.ownConcept = g
  state.own = await createTag({
    name: g.tags[0],
    image: dataUri(OWN, 'image/png'),
  })
  // A Tag Candy icon copied onto a tag by hand counts as the person's.
  state.copied = await createTag({
    name: h.tags[0],
    image: dataUri(await iconBytes(g.icon)),
  })
  state.copiedHash = await iconHash(g)

  const log = await runTask('Apply icons')
  expect(await imageHash(state.own.id)).toBe(OWN_HASH)
  expect(await imageHash(state.copied.id)).toBe(state.copiedHash)
  expect(
    (await findTag(state.copied.id)).custom_fields.tag_candy,
  ).toBeUndefined()
  expect(log.join('\n')).toMatch(
    /Kept your own images on 2 tags\. To use Tag Candy icons there too, turn on Replace my own tag images/,
  )
})

test('an icon the person removed stays removed through Apply and the hooks', async () => {
  await updateTag({ id: state.exact.id, image: null })
  await runTask('Apply icons')
  expect(await imageHash(state.exact.id)).toBeNull()
  await hooks(true)
  await updateTag({ id: state.exact.id, name: `${state.exact.name} renamed` })
  expect(await imageHash(state.exact.id)).toBeNull()
  await hooks(false)
})

test('an edit after Apply makes the icon the person’s', async () => {
  // Point the tag at another concept: Apply would move Tag Candy's own icon
  // there, but this one counts as the person's once the tag is edited.
  const j = pick()
  await outsideWindow()
  await updateTag({ id: state.variant.id, aliases: ['Zz an alias'] })
  await settings({
    leaveNewTagsAlone: true,
    extraMatches: `${state.variant.name}=${j.name}`,
  })
  await runTask('Apply icons')
  expect(await imageHash(state.variant.id)).toBe(
    await iconHash(state.variant.concept),
  )
  await settings({ leaveNewTagsAlone: true })
})

test('a tag holding an older Tag Candy icon gets the new one', async () => {
  const k = pick()
  const old = pick()
  state.older = await createTag({
    name: k.tags[0],
    image: dataUri(await iconBytes(old.icon)),
    custom_fields: { tag_candy: `old-00000000.webp|${Date.now()}` },
  })
  await runTask('Apply icons')
  expect(await imageHash(state.older.id)).toBe(await iconHash(k))
})

test('the hooks give new, renamed and merged tags their icon and leave an image set by the update', async () => {
  const [l, m, n, o] = [pick(), pick(), pick(), pick()]
  const target = await createTag({ name: n.tags[0] })
  const source = await createTag({ name: 'Zz merge source' })
  const renamed = await createTag({ name: 'Zz rename me' })
  const empty = await createTag({ name: o.tags[0] })
  await hooks(true)

  const created = await createTag({ name: l.tags[0] })
  expect(await imageHash(created.id)).toBe(await iconHash(l))
  await updateTag({ id: renamed.id, name: m.tags[0] })
  expect(await imageHash(renamed.id)).toBe(await iconHash(m))
  await gql(
    'mutation ($s: [ID!]!, $d: ID!) { tagsMerge(input: { source: $s, destination: $d }) { id } }',
    { s: [source.id], d: target.id },
  )
  expect(await imageHash(target.id)).toBe(await iconHash(n))
  await updateTag({ id: empty.id, image: dataUri(OWN, 'image/png') })
  expect(await imageHash(empty.id)).toBe(OWN_HASH)
  await hooks(false)
})

test('Remove Tag Candy icons clears its icons and leaves people’s images', async () => {
  await runTask('Remove Tag Candy icons')
  expect(await imageHash(state.linked.id)).toBeNull()
  expect(
    (await findTag(state.linked.id)).custom_fields.tag_candy,
  ).toBeUndefined()
  expect(await imageHash(state.own.id)).toBe(OWN_HASH)
  expect(await imageHash(state.copied.id)).toBe(state.copiedHash)
  await runTask('Apply icons')
  expect(await imageHash(state.linked.id)).toBe(
    await iconHash(state.linked.concept),
  )
})

test('Stash shows the WebP icons on the tags grid and the tag page', async ({
  page,
}) => {
  const loaded = async () => {
    await page.waitForLoadState('networkidle')
    return page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter(
          (i) =>
            /\/tag\/\d+\/image/.test(i.src) && !i.src.includes('default=true'),
        )
        .map((i) => i.complete && i.naturalWidth > 0),
    )
  }
  await page.goto(`${TC}/tags?sortby=name`)
  const grid = await loaded()
  expect(grid.length).toBeGreaterThan(3)
  expect(grid.every(Boolean)).toBe(true)
  await page.goto(`${TC}/tags/${state.linked.id}`)
  const detail = await loaded()
  expect(detail.length).toBeGreaterThan(0)
  expect(detail.every(Boolean)).toBe(true)
})

test('an unreachable icon address changes nothing and names the address', async () => {
  const p = pick()
  const tag = await createTag({ name: p.tags[0] })
  await settings({
    leaveNewTagsAlone: true,
    iconBaseUrl: 'http://127.0.0.1:9/icons/',
  })
  const log = await runTask('Apply icons')
  expect(await imageHash(tag.id)).toBeNull()
  expect(log.join('\n')).toContain('http://127.0.0.1:9/icons/')
  await settings({ leaveNewTagsAlone: true })
  state.retry = { ...tag, concept: p }
})

test('with a password and no API key, Replace my own tag images changes nothing', async () => {
  await lock({ withKey: false })
  await settings({ leaveNewTagsAlone: true, replaceOwnImages: true })
  const log = await runTask('Apply icons')
  expect(log.join('\n')).toContain(
    'Replace my own tag images needs an API key because this Stash has a password',
  )
  expect(await imageHash(state.own.id)).toBe(OWN_HASH)
  expect(await imageHash(state.retry.id)).toBeNull()
})

test('with an API key, Apply copies each replaced image to a backup tag first', async () => {
  apiKey = await lock({ withKey: true })
  const q = pick()
  await runTask('Apply icons')
  expect(await imageHash(state.own.id)).toBe(await iconHash(state.ownConcept))
  const backup = await findByName(`Tag Candy backup ${state.own.id}`)
  expect(backup.parents.map((t) => t.name)).toEqual(['Tag Candy backups'])
  expect(await imageHash(backup.id)).toBe(OWN_HASH)
  const copiedBackup = await findByName(`Tag Candy backup ${state.copied.id}`)
  expect(await imageHash(copiedBackup.id)).toBe(state.copiedHash)
  // The hooks never replace a person's image, even with the setting on.
  await settings({ replaceOwnImages: true })
  const fresh = await createTag({
    name: q.tags[0],
    image: dataUri(OWN, 'image/png'),
  })
  expect(await imageHash(fresh.id)).toBe(OWN_HASH)
  await settings({ leaveNewTagsAlone: true, replaceOwnImages: true })
})

test('Restore puts back replaced images unless the person chose again, and Delete backups clears the rest', async () => {
  await outsideWindow()
  await updateTag({ id: state.copied.id, image: dataUri(OWN, 'image/png') })
  const log = await runTask('Restore replaced images')
  expect(log.join('\n')).toMatch(
    /Restored \d+ images?\. 1 kept the image chosen since/,
  )
  expect(await imageHash(state.own.id)).toBe(OWN_HASH)
  expect((await findTag(state.own.id)).custom_fields.tag_candy).toBeUndefined()
  expect(await findByName(`Tag Candy backup ${state.own.id}`)).toBeNull()
  expect(await imageHash(state.copied.id)).toBe(OWN_HASH)
  expect(await findByName(`Tag Candy backup ${state.copied.id}`)).not.toBeNull()
  await runTask('Delete backups')
  expect(await findByName(`Tag Candy backup ${state.copied.id}`)).toBeNull()
  expect(await findByName('Tag Candy backups')).toBeNull()
  await settings({ leaveNewTagsAlone: true })
})

test('Explicit icons URL gives marked concepts their nude version, by web address and by a path on this Stash', async () => {
  // The shipped data marks no concept yet, so build a script that marks two:
  // one the explicit folder serves and one it does not.
  const [served, missing, stand] = [pick(), pick(), pick()]
  const changed = structuredClone(bundle)
  for (const c of changed.concepts)
    if (c.name === served.name || c.name === missing.name) c.nude = true
  const dir = await mkdtemp(join(tmpdir(), 'tagcandy-'))
  await buildScript(changed, join(dir, 'tagcandy.js'))
  await installScript(join(dir, 'tagcandy.js'))
  // The stand-in nude version is another concept's icon, so its bytes differ.
  await copyFile(
    join(PLUGIN, 'icons', stand.icon),
    join(EXPLICIT_DIR, served.icon.replace(/-[0-9a-f]{8}\.webp$/, '.webp')),
  )
  const servedTag = await createTag({ name: served.tags[0] })
  const missingTag = await createTag({ name: missing.tags[0] })

  await settings({
    leaveNewTagsAlone: true,
    explicitIconsUrl: `${ICONS}/explicit/`,
  })
  await runTask('Apply icons')
  expect(await imageHash(servedTag.id)).toBe(await iconHash(stand))
  expect(await imageHash(missingTag.id)).toBe(await iconHash(missing))
  expect(await imageHash(state.copied.id)).toBe(OWN_HASH)

  await runTask('Remove Tag Candy icons')
  await settings({
    leaveNewTagsAlone: true,
    explicitIconsUrl: '/custom/tagcandy-explicit/',
  })
  await runTask('Apply icons')
  expect(await imageHash(servedTag.id)).toBe(await iconHash(stand))

  await settings({ leaveNewTagsAlone: true })
  await runTask('Apply icons')
  expect(await imageHash(servedTag.id)).toBe(await iconHash(served))
})

test('no log line carries the API key', async () => {
  expect(apiKey).not.toBe('')
  const lines = await allLogs()
  expect(lines.filter((l) => l.includes(apiKey))).toEqual([])
})
