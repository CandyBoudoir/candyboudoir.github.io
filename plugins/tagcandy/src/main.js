// Tag Candy's script. Stash runs it inside its own process for every task and
// hook, with four globals: input (the task's arguments), log, util and gql
// (GraphQL against this Stash). It cannot read files or make HTTP requests, so
// it hands Stash the address of each icon and Stash downloads it.
import DATA from 'tagcandy:data'
import { matchTag, parseExtraMatches } from './match.js'
import { BACKUP_FIELD, FIELD, isBackup, ownership, stamp } from './owner.js'
import {
  iconUrls,
  overrideName,
  overrideUrl,
  redact,
  selfBase,
  withKey,
} from './urls.js'

const PLUGIN_ID = 'TagCandy'
const BACKUP_PARENT = 'Tag Candy backups'
const TAG_FIELDS =
  'id name aliases image_path updated_at custom_fields stash_ids { endpoint stash_id }'
const KEY_NEEDED =
  'needs an API key because this Stash has a password. Generate one in Settings > Security, then run the task again.'
// A download address that cannot be reached this many times without ever
// answering is skipped for the rest of the run, so an unreachable host costs
// three timeouts, not one per tag. A host that answers, even with 404, is up.
const DEAD_AFTER = 3
// The stamp of an override names its file after this prefix. Versions before
// 0.2.0 wrote explicit: for the same thing.
const OVERRIDE = 'override:'
const isOverride = (icon) =>
  typeof icon === 'string' &&
  (icon.startsWith(OVERRIDE) || icon.startsWith('explicit:'))

let index = null
let apiKey = ''
const data = () => index || (index = JSON.parse(DATA))
const query = (q, variables) => gql.Do(q, variables || {})
const message = (e) => redact(e && e.message ? e.message : e, apiKey)

const UPDATE = 'mutation ($i: TagUpdateInput!) { tagUpdate(input: $i) { id } }'
const CREATE =
  'mutation ($i: TagCreateInput!) { tagCreate(input: $i) { id name } }'

function readSettings() {
  const r = query(
    `query { configuration { plugins(include: ["${PLUGIN_ID}"]) } }`,
  )
  const s = (r.configuration.plugins || {})[PLUGIN_ID] || {}
  return {
    hooks: s.leaveNewTagsAlone !== true,
    extra: s.extraMatches || '',
    // Shown as Icon overrides URL; the id is the one 0.1 named Explicit icons URL.
    overrides: String(s.explicitIconsUrl || '').trim(),
    // Not shown in Settings: the tests point Tag Candy at a local copy of
    // the icons with configurePlugin.
    iconBase: s.iconBaseUrl || '',
  }
}

// What a download from this Stash's own address needs: the address, and the
// API key when Stash has a password.
function access() {
  const conn =
    (input && (input.ServerConnection || input.server_connection)) || {}
  const g = query('query { configuration { general { apiKey username } } }')
    .configuration.general
  const locked = Boolean(g.username)
  apiKey = locked ? g.apiKey || '' : ''
  return { self: selfBase(conn), key: apiKey, missingKey: locked && !g.apiKey }
}

const allTags = () =>
  query(
    `query { findTags(filter: { per_page: -1 }) { tags { ${TAG_FIELDS} } } }`,
  ).findTags.tags

// The HTTP status of a download the host answered with an error, from
// Stash's "http error 404", or 0 when it did not answer.
const httpStatus = (e) => {
  const m = /http error (\d{3})/.exec(message(e))
  return m ? Number(m[1]) : 0
}

// Sets a tag's image from the first address that works, with the tag_candy
// stamp in the same update. Returns null, or the last error, with its HTTP
// status when the host answered and dead when the host was skipped.
function setImage(tag, urls, iconId, health) {
  let last = null
  for (const url of urls) {
    const q = url.indexOf('?')
    const base = url.slice(0, url.lastIndexOf('/', q < 0 ? url.length : q) + 1)
    const h = health.get(base) || { fails: 0, ok: false }
    health.set(base, h)
    if (!h.ok && h.fails >= DEAD_AFTER) {
      if (!last) {
        last = new Error(`${redact(base, apiKey)} did not answer`)
        last.dead = true
      }
      continue
    }
    try {
      query(UPDATE, {
        i: {
          id: tag.id,
          image: url,
          custom_fields: { partial: { [FIELD]: stamp(iconId, Date.now()) } },
        },
      })
      h.ok = true
      return null
    } catch (e) {
      const status = httpStatus(e)
      if (status) h.ok = true
      else h.fails++
      last = new Error(`${redact(url.split('?')[0], apiKey)}: ${message(e)}`)
      last.status = status
    }
  }
  return last
}

// Stops asking Icon overrides URL for a concept after a 404, or for anything
// once it refuses Tag Candy or does not answer. Tags already showing an
// override keep it then, since only a 404 says the file is gone.
function noOverride(ctx, concept, err) {
  if (err.status === 401 || err.status === 403) {
    log.Warn(
      `Icon overrides URL answered ${err.status}, so Tag Candy asks it for nothing more this run and leaves the overrides tags already show. For a path on this Stash, check the API key in Settings > Security.`,
    )
    ctx.overrides = ''
    ctx.overridesDown = true
  } else if (err.dead) {
    log.Warn(
      `Icon overrides URL did not answer, so Tag Candy asks it for nothing more this run and leaves the overrides tags already show: ${err.message}`,
    )
    ctx.overrides = ''
    ctx.overridesDown = true
  } else ctx.noOverride.add(concept.n)
}

// Gives a tag its icon: the concept's override first when Icon overrides URL
// serves one, else its regular icon. shown is the icon the tag shows now, so a
// tag that already shows the regular icon is not sent it again. Returns
// { error, id } with the icon id the tag shows afterwards, null when the
// concept has neither.
function giveIcon(tag, concept, ctx, shown) {
  if (ctx.overridesDown && isOverride(shown)) return { error: null, id: shown }
  if (ctx.overrides && !ctx.noOverride.has(concept.n)) {
    const file = overrideName(concept.n)
    const id = OVERRIDE + file
    const err = setImage(
      tag,
      [overrideUrl(ctx.overrides, file, ctx.self, ctx.key)],
      id,
      ctx.health,
    )
    if (!err) return { error: null, id }
    noOverride(ctx, concept, err)
  }
  if (!concept.i) return { error: null, id: null }
  if (shown === concept.i) return { error: null, id: shown }
  return {
    error: setImage(
      tag,
      iconUrls(concept.i, ctx.iconBase),
      concept.i,
      ctx.health,
    ),
    id: concept.i,
  }
}

// Takes an override off a tag whose concept has no regular icon to go back to.
function clearOverride(tag) {
  try {
    query(UPDATE, {
      i: { id: tag.id, image: null, custom_fields: { remove: [FIELD] } },
    })
    return null
  } catch (e) {
    return new Error(message(e))
  }
}

function runContext(s, replace) {
  const ctx = {
    overrides: s.overrides,
    // Set when Icon overrides URL cannot be checked this run.
    overridesDown: false,
    iconBase: s.iconBase,
    noOverride: new Set(),
    health: new Map(),
    self: '',
    key: '',
    missingKey: false,
  }
  if (replace || s.overrides.startsWith('/')) {
    const a = access()
    ctx.self = a.self
    ctx.key = a.key
    ctx.missingKey = a.missingKey
  }
  if (ctx.overrides.startsWith('/') && ctx.missingKey) {
    log.Warn(
      `Icon overrides URL is a path on this Stash, which ${KEY_NEEDED} Until then Tag Candy gives no new overrides and leaves the ones tags already show.`,
    )
    ctx.overrides = ''
    ctx.overridesDown = true
  }
  return ctx
}

function backupTags(tags) {
  const backups = new Map()
  let parent = null
  for (const t of tags) {
    if (!isBackup(t)) continue
    const v = String(t.custom_fields[BACKUP_FIELD])
    if (v === 'parent') parent = t
    else backups.set(v, t)
  }
  return { backups, parent }
}

function backupParent(store) {
  if (store.parent) return store.parent
  const fields = {
    name: BACKUP_PARENT,
    ignore_auto_tag: true,
    description:
      'Images Tag Candy replaced, one tag each. Restore replaced images puts them back, and Delete backups removes these tags.',
    custom_fields: { [BACKUP_FIELD]: 'parent' },
  }
  try {
    store.parent = query(CREATE, { i: fields }).tagCreate
  } catch (e) {
    // A tag of that name without the field: adopt it.
    const found = query(
      'query ($n: String!) { findTags(tag_filter: { name: { value: $n, modifier: EQUALS } }) { tags { id } } }',
      { n: BACKUP_PARENT },
    ).findTags.tags[0]
    if (!found) throw e
    query(UPDATE, {
      i: {
        id: found.id,
        custom_fields: { partial: { [BACKUP_FIELD]: 'parent' } },
      },
    })
    store.parent = found
  }
  return store.parent
}

// Copies a tag's image onto its backup tag, which Stash downloads from its
// own address. Returns null, or the error.
function backupImage(tag, ctx, store) {
  const url = withKey(`${ctx.self}/tag/${tag.id}/image`, ctx.key)
  try {
    const existing = store.backups.get(String(tag.id))
    if (existing) {
      query(UPDATE, { i: { id: existing.id, image: url } })
    } else {
      const created = query(CREATE, {
        i: {
          name: `Tag Candy backup ${tag.id}`,
          ignore_auto_tag: true,
          parent_ids: [backupParent(store).id],
          image: url,
          custom_fields: { [BACKUP_FIELD]: String(tag.id) },
        },
      }).tagCreate
      store.backups.set(String(tag.id), created)
    }
    return null
  } catch (e) {
    return new Error(message(e))
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Apply icons and Dry run, and with replace, Replace my own images.
function apply(dry, replace) {
  const s = readSettings()
  const idx = data()
  const extra = parseExtraMatches(s.extra, idx)
  if (extra.unknown.length)
    log.Warn(
      `Extra matches name concepts Tag Candy does not know: ${extra.unknown.join(', ')}`,
    )
  const ctx = runContext(s, replace)
  if (replace && ctx.missingKey) {
    const text = `Replace my own images ${KEY_NEEDED}`
    log.Warn(text)
    return { Output: text }
  }

  const tags = allTags()
  const store = backupTags(tags)
  const live = tags.filter((t) => !isBackup(t))
  const n = {
    set: 0,
    updated: 0,
    replaced: 0,
    current: 0,
    kept: 0,
    removed: 0,
    noIcon: 0,
    failed: 0,
    overrides: 0,
  }
  const unmatched = []
  const failures = []
  const asked = []

  live.forEach((tag, i) => {
    if (i % 25 === 0) log.Progress(i / live.length)
    const m = matchTag(tag, idx, extra.pairs)
    if (m.concept === null) return unmatched.push(tag.name)
    const concept = m.concept >= 0 ? idx.concepts[m.concept] : null
    const own = ownership(tag)
    const shown = own.state === 'mine' ? own.stamp.icon : null
    // Nothing to give, and no override of Tag Candy's to take back.
    if (!concept || (!concept.i && !ctx.overrides && !isOverride(shown)))
      return n.noIcon++

    let action
    if (own.state === 'empty') action = 'set'
    else if (own.state === 'removed') action = replace ? 'set' : 'removed'
    else if (own.state === 'mine') action = 'updated'
    else action = replace && concept.i ? 'replaced' : 'kept'
    if (action === 'kept' || action === 'removed') return n[action]++
    // With no overrides to ask for, a tag showing its regular icon is current.
    if (action === 'updated' && !ctx.overrides && shown === concept.i)
      return n.current++
    if (dry) {
      if (ctx.overrides) asked.push(`${tag.name}: ${overrideName(concept.n)}`)
      if (action === 'updated' && (shown === concept.i || isOverride(shown)))
        return n.current++
      n[action]++
      return log.Info(
        `Would ${action === 'set' ? 'give' : action === 'updated' ? 'update' : 'replace the image on'} ${tag.name}: ${concept.n}`,
      )
    }
    if (action === 'replaced') {
      const err = backupImage(tag, ctx, store)
      if (err) {
        n.failed++
        return failures.push(
          `${tag.name}: kept, because its image could not be copied to a backup tag (${err.message})`,
        )
      }
    }
    const { error, id } = giveIcon(tag, concept, ctx, shown)
    if (error) {
      n.failed++
      return failures.push(`${tag.name}: ${error.message}`)
    }
    if (id === null) {
      if (!isOverride(shown)) return n.noIcon++
      const err = clearOverride(tag)
      if (err) {
        n.failed++
        return failures.push(`${tag.name}: ${err.message}`)
      }
      return n.updated++
    }
    if (isOverride(id)) n.overrides++
    if (action === 'updated' && id === shown) n.current++
    else n[action]++
  })
  log.Progress(1)

  const verb = dry ? 'would give' : 'gave'
  const shows = !dry && s.overrides ? `, ${n.overrides} show an override` : ''
  const lines = [
    `${dry ? 'Dry run: Tag Candy' : 'Tag Candy'} ${verb} ${plural(n.set, 'tag', 'tags')} an icon, ${dry ? 'would update' : 'updated'} ${n.updated} and ${dry ? 'would replace' : 'replaced'} ${plural(n.replaced, 'image', 'images')} of yours. ${n.current} already current${shows}, ${n.kept} kept your own image, ${n.removed} left without the icon you removed, ${n.noIcon} have no icon yet, ${unmatched.length} matched nothing${dry ? '' : `, ${n.failed} failed`}.`,
  ]
  if (n.kept && !replace)
    lines.push(
      `Kept your own images on ${plural(n.kept, 'tag', 'tags')}. To use Tag Candy icons there too, run Replace my own images in Settings > Tasks. Tag Candy copies every image it replaces to a backup tag, and Restore replaced images puts them back.`,
    )
  if (asked.length)
    lines.push(
      `Apply asks Icon overrides URL first for these files, and Dry run cannot see which of them it holds: ${asked.sort().join('; ')}`,
    )
  if (unmatched.length)
    lines.push(`Matched nothing: ${unmatched.sort().join(', ')}`)
  for (const line of lines) log.Info(line)
  for (const f of failures.slice(0, 20)) log.Warn(f)
  if (failures.length > 20)
    log.Warn(`and ${failures.length - 20} more failures`)
  return { Output: lines[0] }
}

function restore() {
  const ctx = access()
  if (ctx.missingKey) {
    const text = `Restore replaced images ${KEY_NEEDED}`
    log.Warn(text)
    return { Output: text }
  }
  const tags = allTags()
  const byId = new Map(tags.map((t) => [String(t.id), t]))
  const store = backupTags(tags)
  let restored = 0
  let newer = 0
  let gone = 0
  for (const [sourceId, backup] of store.backups) {
    const source = byId.get(sourceId)
    if (!source) {
      gone++
      continue
    }
    if (ownership(source).state !== 'mine') {
      newer++
      continue
    }
    query(UPDATE, {
      i: {
        id: source.id,
        image: withKey(`${ctx.self}/tag/${backup.id}/image`, ctx.key),
        custom_fields: { remove: [FIELD] },
      },
    })
    query('mutation ($i: TagDestroyInput!) { tagDestroy(input: $i) }', {
      i: { id: backup.id },
    })
    store.backups.delete(sourceId)
    restored++
  }
  if (store.parent && store.backups.size === 0)
    query('mutation ($i: TagDestroyInput!) { tagDestroy(input: $i) }', {
      i: { id: store.parent.id },
    })
  const text = `Restored ${plural(restored, 'image', 'images')}. ${newer} kept the image chosen since, and ${gone} backups belong to tags that no longer exist; Delete backups removes what is left.`
  log.Info(text)
  return { Output: text }
}

function deleteBackups() {
  const store = backupTags(allTags())
  const ids = [...store.backups.values()].map((t) => t.id)
  if (store.parent) ids.push(store.parent.id)
  if (ids.length)
    query('mutation ($ids: [ID!]!) { tagsDestroy(ids: $ids) }', { ids })
  const text = `Deleted ${plural(store.backups.size, 'backup tag', 'backup tags')}.`
  log.Info(text)
  return { Output: text }
}

function removeIcons() {
  let cleared = 0
  for (const tag of allTags()) {
    if (
      isBackup(tag) ||
      !tag.custom_fields ||
      tag.custom_fields[FIELD] === undefined
    )
      continue
    const mine = ownership(tag).state === 'mine'
    query(UPDATE, {
      i: mine
        ? { id: tag.id, image: null, custom_fields: { remove: [FIELD] } }
        : { id: tag.id, custom_fields: { remove: [FIELD] } },
    })
    if (mine) cleared++
  }
  const text = `Removed Tag Candy's icon from ${plural(cleared, 'tag', 'tags')}. Every other image stays.`
  log.Info(text)
  return { Output: text }
}

// New, renamed and merged tags: fill an empty tag, and touch nothing else.
// The settings are read only for a tag that has no image: this runs on every
// tag change, and a configuration query can freeze Stash 0.30 to 0.31.1 when
// it meets a configuration write.
function hook(context) {
  const fields = context.inputFields || []
  if (context.type === 'Tag.Update.Post' && fields.indexOf('image') >= 0)
    return { Output: 'The update set the image itself.' }
  const tag = query(`query ($id: ID!) { findTag(id: $id) { ${TAG_FIELDS} } }`, {
    id: String(context.id),
  }).findTag
  if (!tag || isBackup(tag) || ownership(tag).state !== 'empty')
    return { Output: 'Nothing to do.' }
  const s = readSettings()
  if (!s.hooks) return { Output: 'Leave new and renamed tags alone is on.' }
  const idx = data()
  const m = matchTag(tag, idx, parseExtraMatches(s.extra, idx).pairs)
  const concept =
    m.concept !== null && m.concept >= 0 ? idx.concepts[m.concept] : null
  if (!concept || (!concept.i && !s.overrides))
    return { Output: `No icon for ${tag.name}.` }
  const { error, id } = giveIcon(tag, concept, runContext(s, false), null)
  if (error) {
    log.Warn(`Could not give ${tag.name} its icon: ${error.message}`)
    return { Error: error.message }
  }
  if (id === null) return { Output: `No icon for ${tag.name}.` }
  return {
    Output: `Gave ${tag.name} the ${concept.n} ${isOverride(id) ? 'override' : 'icon'}.`,
  }
}

function run() {
  const args = (input && input.Args) || {}
  if (args.hookContext) return hook(args.hookContext)
  switch (args.mode) {
    case 'apply':
      return apply(false, false)
    case 'dryrun':
      return apply(true, false)
    case 'replace':
      return apply(false, true)
    case 'restore':
      return restore()
    case 'deletebackups':
      return deleteBackups()
    case 'remove':
      return removeIcons()
    default:
      return { Error: `Unknown task ${args.mode}` }
  }
}

let output
try {
  output = run()
} catch (e) {
  log.Error(message(e))
  output = { Error: message(e) }
}
export const result = output
