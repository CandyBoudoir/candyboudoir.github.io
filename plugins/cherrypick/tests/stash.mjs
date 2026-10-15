// Cherry Pick's test helpers, on top of the ones every plugin shares. Cherry
// Pick needs a library with ratings and plays, so its specs seed the demo
// library (demo-library.mjs) next to the shared one and remove it after.
import {
  gql,
  setPluginSettings,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'
import { DEMO, removeDemoLibrary, seedDemoLibrary } from './demo-library.mjs'

export * from '../../../tests/stash/helpers.mjs'
export { DEMO }

export const PLUGIN_ID = 'CherryPick'

// Cherry Pick alone, with a fresh configuration and the demo library.
export async function setUpCherryPick() {
  await usePlugins(PLUGIN_ID)
  await setPluginSettings(PLUGIN_ID, {})
  return seedDemoLibrary(gql)
}

export async function tearDownCherryPick() {
  await removeDemoLibrary(gql)
  await setPluginSettings(PLUGIN_ID, {})
}

// The plugin's configuration map as Stash holds it.
export async function pluginConfig() {
  const { configuration } = await gql('{ configuration { plugins } }')
  return configuration.plugins?.[PLUGIN_ID] ?? null
}

// A demo scene by what it is: rated or not, played or not.
export function demoScene(ids, { rated, played }) {
  const s = DEMO.scenes.find(
    (x) => !!x.rating100 === rated && !!x.plays.length === played,
  )
  return ids.scenes[s.title]
}

// The For you row is there once the library and the model are in.
export const forYouCards = (page) =>
  page.locator(
    '.cherrypick-for-you .slick-slide:not(.slick-cloned) .scene-card',
  )
