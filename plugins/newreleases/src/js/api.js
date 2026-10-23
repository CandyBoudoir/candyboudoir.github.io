// Stash's plugin API, in one place. Stash loads plugin scripts after it sets
// window.PluginApi, so these are safe to read at module load.
const api = window.PluginApi

export const { GQL, React, patch, register, utils } = api
export const { Bootstrap, Apollo, ReactRouterDOM, FontAwesomeSolid } =
  api.libraries
export const ReactSelect = api.libraries.ReactSelect
export const Slider = api.libraries.ReactSlick.default
export const components = api.components
export const { loadableComponents } = api

// Stash's own Apollo client: its auth and its address.
const client = () => utils.StashService.getClient()
export const gql = Apollo.gql

export async function query(doc, variables) {
  const { data } = await client().query({
    query: doc,
    variables,
    fetchPolicy: 'network-only',
  })
  return data
}

// From Stash's cache when it holds the answer: Stash keeps its own
// configuration there, current after every save its pages make.
export async function cached(doc) {
  const { data } = await client().query({
    query: doc,
    fetchPolicy: 'cache-first',
  })
  return data
}

export async function mutate(doc, variables) {
  const { data } = await client().mutate({ mutation: doc, variables })
  return data
}
