// Stash's plugin API, in one place. Stash loads plugin scripts after it sets
// window.PluginApi, so these are safe to read at module load.
const api = window.PluginApi

export const { React, ReactDOM, GQL, patch, register, hooks, utils } = api
export const { Bootstrap, Apollo, ReactRouterDOM, FontAwesomeSolid } =
  api.libraries
export const components = api.components

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
