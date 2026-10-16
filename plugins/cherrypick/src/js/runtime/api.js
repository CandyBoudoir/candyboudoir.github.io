// Stash's plugin API, in one place. Stash loads plugin scripts after it sets
// window.PluginApi, so these are safe to read at module load.
const api = window.PluginApi

export const { React, ReactDOM, GQL, patch, register, hooks, utils } = api
export const { Bootstrap, Apollo, ReactRouterDOM, FontAwesomeSolid } =
  api.libraries
export const components = api.components

// patch.after, with fn(props, result). Stash calls an after patch with the
// arguments the before patches left and then the result, so the result is
// last but not always third: a before patch that returns [props] alone, as
// Stash Curator's do, leaves it second (docs/stash-seams.md).
export const patchAfter = (name, fn) =>
  patch.after(name, (props, ...rest) => fn(props, rest[rest.length - 1]))

// Stash's own Apollo client: its auth, its cache. Mutations made through it
// update Stash's cached records, so Stash's pages show what the plugin wrote.
export const client = () => utils.StashService.getClient()
export const gql = Apollo.gql

export async function query(doc, variables, fetchPolicy = 'network-only') {
  const { data } = await client().query({ query: doc, variables, fetchPolicy })
  return data
}

export async function mutate(doc, variables) {
  const { data } = await client().mutate({ mutation: doc, variables })
  return data
}
