// Addresses Tag Candy hands Stash to download images from.

// Each icon's name carries its content hash, and the site keeps every icon a
// released version names, so one name means one picture. A stable build finds
// its icons at the first address; a develop build's newest icons are only at
// the second, so Tag Candy tries them in turn.
export const ICON_BASES = [
  'https://candyboudoir.github.io/tagcandy/icons/',
  'https://candyboudoir.github.io/develop/tagcandy/icons/',
]

const join = (base, file) => (base.endsWith('/') ? base : `${base}/`) + file

export const iconUrls = (icon, override) =>
  override ? [join(override, icon)] : ICON_BASES.map((b) => b + icon)

// This Stash's own address, from the host and port Stash gives the task.
// Stash listens on 0.0.0.0 by default, which is not an address to connect to.
export function selfBase(conn) {
  const scheme = (conn && conn.Scheme) || 'http'
  let host = (conn && conn.Host) || ''
  if (host === '' || host === '0.0.0.0') host = '127.0.0.1'
  else if (host === '::' || host === '[::]') host = '[::1]'
  else if (host.includes(':') && !host.startsWith('[')) host = `[${host}]`
  return `${scheme}://${host}:${(conn && conn.Port) || 9999}`
}

export const withKey = (url, key) =>
  key
    ? `${url}${url.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(key)}`
    : url

// A nude version is named like the regular icon without its hash:
// stockings-1a2b3c4d.webp -> stockings.webp.
export const explicitName = (icon) =>
  icon.replace(/-[0-9a-f]{8}\.webp$/, '.webp')

// The Explicit icons URL setting is a web address, or a path on this Stash
// (served through custom_served_folders), which needs the API key when Stash
// has a password.
export function explicitUrl(setting, icon, self, key) {
  const base = String(setting ?? '').trim()
  if (!base) return null
  const file = explicitName(icon)
  return base.startsWith('/')
    ? withKey(join(self + base, file), key)
    : join(base, file)
}

// Keeps the API key out of anything Tag Candy logs or returns.
export function redact(text, key) {
  let out = String(text)
  if (!key) return out
  for (const k of [key, encodeURIComponent(key)])
    out = out.split(k).join('<api key>')
  return out
}
