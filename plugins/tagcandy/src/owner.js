// Which images are Tag Candy's own. The plugin cannot read an image's bytes
// inside Stash, so it judges by time: it sets an image together with a
// tag_candy custom field holding the icon's name and the time it sent the
// update, and Stash stamps the tag's updated_at, to the second, when the
// update arrives. While updated_at sits in that second or up to two seconds
// after, nothing has touched the tag since, and the image is Tag Candy's.
// Any later edit (a new image, a rename, an alias) moves updated_at on, and
// from then on the image counts as the person's.

export const FIELD = 'tag_candy'
export const BACKUP_FIELD = 'tag_candy_backup'
export const WINDOW_MS = 2000

export const stamp = (icon, at) => `${icon}|${at}`

export function parseStamp(value) {
  if (typeof value !== 'string') return null
  const bar = value.lastIndexOf('|')
  if (bar < 1) return null
  const at = Number(value.slice(bar + 1))
  return Number.isFinite(at) ? { icon: value.slice(0, bar), at } : null
}

// Stash gives a tag with no image an image_path ending in default=true.
export const hasImage = (tag) =>
  Boolean(tag.image_path) && !/[?&]default=true/.test(tag.image_path)

export const isBackup = (tag) =>
  Boolean(tag.custom_fields) && tag.custom_fields[BACKUP_FIELD] !== undefined

// Returns { state, stamp }, state being:
//   empty    no image, and Tag Candy never set one
//   removed  no image, but Tag Candy set one and the person removed it
//   mine     the image is Tag Candy's and the tag is untouched since
//   theirs   any other image: the person's, another plugin's, or Tag Candy's
//            on a tag edited since
export function ownership(tag) {
  const s = parseStamp(tag.custom_fields && tag.custom_fields[FIELD])
  if (!hasImage(tag)) return { state: s ? 'removed' : 'empty', stamp: s }
  if (!s) return { state: 'theirs', stamp: null }
  const updated = Date.parse(tag.updated_at)
  const second = Math.floor(s.at / 1000) * 1000
  const mine = updated >= second && updated <= s.at + WINDOW_MS
  return { state: mine ? 'mine' : 'theirs', stamp: s }
}
