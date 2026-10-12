// Helpers shared by the compatibility tests.
export const STASH = process.env.STASH_URL ?? 'http://127.0.0.1:9999'

export async function gql(query, variables = {}) {
  const res = await fetch(`${STASH}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

// Ids of a seeded scene with performers and a favourite performer, so detail
// pages show the parts Juicy styles.
export async function demoIds() {
  const { findScenes, findPerformers } = await gql(`{
    findScenes(filter: { per_page: 1, sort: "path" }) { scenes { id } }
    findPerformers(filter: { per_page: 1, sort: "name" },
      performer_filter: { filter_favorites: true }) { performers { id } }
  }`)
  return {
    scene: findScenes.scenes[0].id,
    performer: findPerformers.performers[0].id,
  }
}

export const setPlugin = (input) =>
  gql(
    'mutation ($i: Map!) { configurePlugin(plugin_id: "Theme-Juicy", input: $i) }',
    {
      i: input,
    },
  )

export const setSfw = (on) =>
  gql(
    'mutation ($on: Boolean) { configureInterface(input: { sfwContentMode: $on }) { sfwContentMode } }',
    {
      on,
    },
  )

// Pages Juicy styles, the element to wait for, and the Stash elements Juicy
// depends on there. A missing element means Stash changed its markup.
export const PAGES = [
  [
    'scenes',
    '/scenes',
    '.scene-card',
    [
      '.top-nav',
      '.navbar-buttons',
      '.grid-card',
      '.scene-card',
      '.thumbnail-section',
      '.rating-banner',
      '.card-popovers',
      '.count-button',
      '.studio-overlay',
      '.paginationIndex',
      '.filtered-list-toolbar',
    ],
  ],
  [
    'scene',
    '/scenes/:scene',
    '.video-js',
    [
      '.rating-stars',
      '.tag-item',
      '.count-button',
      '.performer-card',
      '.vjs-control-bar',
      '.scrubber-tags-background',
      '.scrubber-button',
      '.scene-divider',
    ],
  ],
  [
    'performers',
    '/performers',
    '.performer-card',
    ['.performer-card', '.favorite-button', '.rating-banner'],
  ],
  [
    'performer',
    '/performers/:performer',
    '.detail-header',
    ['.detail-header', '.rating-stars', '.favorite-button'],
  ],
  ['studios', '/studios', '.studio-card', ['.studio-card']],
  ['tags', '/tags', '.tag-card', ['.tag-card']],
]

export const EMPTY_LIST = '/scenes?q=nothing-matches-this'
export const CHEEKY_EMPTY_LINE = 'Nothing juicy here. Yet.'
