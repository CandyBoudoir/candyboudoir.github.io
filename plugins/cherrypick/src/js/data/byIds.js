// Records by id from Stash, when some of the ids may be gone. Stash fails a
// whole findScenes or findPerformers by ids if one id is missing ("scene
// with id N not found": FindMany in pkg/sqlite, v0.31.1), and Cherry Pick
// can hold ids Stash has since lost: a visit's rows hold still while scenes
// are deleted or merged, a reload within two minutes reuses the library's
// copy, and the Hall of Fame keeps every champion a bracket crowned.
//
// fetch(ids) resolves to the records for ids. On a failed batch, each id is
// fetched on its own, and those Stash still has come back in the order of
// ids. If every one fails, Stash itself failed: the first error is thrown.
export async function recordsByIds(fetch, ids) {
  try {
    return await fetch(ids)
  } catch (e) {
    if (ids.length < 2) throw e
    const each = await Promise.allSettled(ids.map((id) => fetch([id])))
    if (each.every((r) => r.status === 'rejected')) throw e
    return each.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  }
}
