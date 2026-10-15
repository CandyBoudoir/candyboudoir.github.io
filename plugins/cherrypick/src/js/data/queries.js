// The GraphQL documents Cherry Pick sends to Stash. Plain strings here so the
// pure data code can be tested in Node; runtime/api.js parses them with
// Apollo's gql before they reach Stash's client.

// Owned scenes, with everything the taste model and For you read.
export const SCENES = `
  query CherryPickScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
    findScenes(filter: $filter, scene_filter: $scene_filter) {
      count
      scenes {
        id
        title
        date
        created_at
        updated_at
        rating100
        organized
        o_counter
        play_count
        play_duration
        play_history
        last_played_at
        resume_time
        files { duration }
        paths { screenshot }
        stash_ids { endpoint stash_id }
        studio { id name parent_studio { id name } }
        performers { id name disambiguation gender favorite image_path }
        tags { id name }
      }
    }
  }
`

// Library performers, for brackets, affinity and the performer page.
export const PERFORMERS = `
  query CherryPickPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      count
      performers {
        id
        name
        disambiguation
        gender
        rating100
        favorite
        image_path
        scene_count
        updated_at
        stash_ids { endpoint stash_id }
        custom_fields
      }
    }
  }
`

// Stash's configured stash-boxes and this plugin's configuration map.
export const CONFIGURATION = `
  query CherryPickConfiguration {
    configuration {
      general { stashBoxes { endpoint api_key name } }
      plugins
    }
  }
`

export const CONFIGURE_PLUGIN = `
  mutation CherryPickConfigurePlugin($plugin_id: ID!, $input: Map!) {
    configurePlugin(plugin_id: $plugin_id, input: $input)
  }
`

export const PERFORMER_UPDATE = `
  mutation CherryPickPerformerUpdate($input: PerformerUpdateInput!) {
    performerUpdate(input: $input) {
      id
      gender
      rating100
      custom_fields
    }
  }
`

export const SCENE_UPDATE = `
  mutation CherryPickSceneUpdate($input: SceneUpdateInput!) {
    sceneUpdate(input: $input) { id rating100 }
  }
`
