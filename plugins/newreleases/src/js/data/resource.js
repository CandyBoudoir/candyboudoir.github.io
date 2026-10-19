// Values loaded once per key, for React Suspense: read() throws the load's
// promise until it settles, so the nearest Suspense boundary shows its
// spinner meanwhile, then returns the value or throws the error for the
// nearest error boundary. Each visit to the page uses keys of its own and
// forgets them when it ends, so the next visit reads Stash again.
const cache = new Map()

export function read(key, load) {
  let entry = cache.get(key)
  if (!entry) {
    entry = { status: 'pending' }
    entry.promise = Promise.resolve()
      .then(load)
      .then(
        (value) => Object.assign(entry, { status: 'done', value }),
        (error) => Object.assign(entry, { status: 'failed', error }),
      )
    cache.set(key, entry)
  }
  if (entry.status === 'pending') throw entry.promise
  if (entry.status === 'failed') throw entry.error
  return entry.value
}

export function forget(prefix) {
  for (const key of [...cache.keys()])
    if (key.startsWith(prefix)) cache.delete(key)
}
