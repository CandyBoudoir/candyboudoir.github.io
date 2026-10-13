// The invented catalogue the mock stash-box serves (stashbox.mjs), and the
// demo-library entities prepare.mjs links to it. Some names match the demo
// library and some do not, so the Tagger shows linked, matched and new
// performers, studios and tags side by side.
export const STASH_BOX_PORT = Number(process.env.STASH_BOX_PORT ?? 9998)
export const STASH_BOX = `http://127.0.0.1:${STASH_BOX_PORT}`
export const ENDPOINT = `${STASH_BOX}/graphql`
export const BOX_NAME = 'CandyDB'

const image = (key, width, height) => ({
  id: `img-${key}`,
  url: `${STASH_BOX}/images/${key}.png`,
  width,
  height,
})

// Images, rendered from Juicy's stickers when the mock starts.
export const IMAGES = [
  ['gigi', 'mascot', '#ffd6ec', '#fc68b2', 400, 600],
  ['bijou', 'lips', '#e9d6ff', '#9b30ff', 400, 600],
  ['sherbet', 'cherry', '#fff3c4', '#fdda4e', 400, 600],
  ['mae', 'crown', '#eaffc2', '#d7fa54', 400, 600],
  ['mae-2', 'sparkle', '#eaffc2', '#9bd82e', 400, 600],
  ['trixie', 'heart-lock', '#d4f1ff', '#00a8f0', 400, 600],
  ['sugar-rush', 'bubble', '#ffe0f0', '#fc3d9f', 640, 360],
  ['cherry-pop', 'cherry', '#fff3c4', '#f0b81c', 640, 360],
  ['sweet-tooth', 'heart', '#e9d6ff', '#9b30ff', 640, 360],
  ['lollipop-lane', 'sparkle', '#d4f1ff', '#00a8f0', 640, 360],
  ['pop-club', 'bolt', '#ffd6ec', '#dd2a97', 400, 200],
  ['candy-kitchen', 'crown', '#fff3c4', '#fdda4e', 400, 200],
].map(([key, icon, from, to, width, height]) => ({
  key,
  icon,
  from,
  to,
  width,
  height,
}))

const flavour = { id: 'cat-flavour', name: 'Flavour', description: null }

const tag = (id, name, description, aliases = []) => ({
  id,
  name,
  description,
  aliases,
  category: flavour,
})

const tags = [
  tag('t-candy', 'Candy', 'Anything sweet.', ['Sweets']),
  tag('t-glossy', 'Glossy', 'A shine you can see yourself in.'),
  tag('t-pastel', 'Pastel', 'Soft sugared colours.'),
  tag('t-bubblegum', 'Bubblegum', 'Blown, popped and blown again.'),
  tag('t-sprinkles', 'Sprinkles', 'A little extra on top.'),
]

const studio = (id, name, key, parent = null) => ({
  id,
  name,
  aliases: [],
  urls: [{ url: `https://example.com/studios/${id}`, type: 'HOME' }],
  parent,
  images: key ? [image(key, 400, 200)] : [],
})

const network = { id: 'st-network', name: 'Candy Network' }
const studios = [
  studio('st-pop', 'Pop Club', 'pop-club'),
  studio('st-sugar', 'Sugar Shack', null),
  studio('st-kitchen', 'Candy Kitchen', 'candy-kitchen', network),
  { ...studio('st-network', 'Candy Network', null), parent: null },
]

const performer = (id, name, keys, extra = {}) => ({
  id,
  name,
  disambiguation: null,
  aliases: [],
  gender: 'FEMALE',
  merged_ids: [],
  deleted: false,
  merged_into_id: null,
  urls: [{ url: `https://example.com/performers/${id}`, type: 'HOME' }],
  images: keys.map((key) => image(key, 400, 600)),
  birth_date: '1999-02-14',
  death_date: null,
  ethnicity: null,
  country: 'US',
  eye_color: 'BROWN',
  hair_color: 'RED',
  height: 165,
  measurements: { band_size: null, cup_size: null, waist: null, hip: null },
  breast_type: null,
  career_start_year: 2020,
  career_end_year: null,
  tattoos: [],
  piercings: [],
  ...extra,
})

const performers = [
  performer('p-gigi', 'Gumdrop Gigi', ['gigi']),
  performer('p-bijou', 'Bonbon Bijou', ['bijou'], { aliases: ['Bijou'] }),
  performer('p-sherbet', 'Sherbet Sparks', ['sherbet']),
  performer('p-mae', 'Marzipan Mae', ['mae', 'mae-2'], {
    aliases: ['Mae Marzipan'],
    country: 'FR',
    hair_color: 'BLONDE',
  }),
  performer('p-trixie', 'Toffee Trixie', ['trixie'], {
    disambiguation: 'Sweet Shop',
    country: 'GB',
  }),
]

const byId = (list, ids) => ids.map((id) => list.find((x) => x.id === id))

const scene = (id, title, n, studioId, performerIds, tagIds) => ({
  id,
  title,
  code: `CDB-${String(n).padStart(3, '0')}`,
  details: `${title}, as the catalogue tells it: invented for Juicy's tests.`,
  director: 'Fizzy Fern',
  duration: 8,
  date: `2026-0${n}-14`,
  urls: [{ url: `https://example.com/scenes/${id}`, type: 'STUDIO' }],
  images: [image(id.slice(2), 640, 360)],
  studio: studios.find((s) => s.id === studioId),
  tags: byId(tags, tagIds),
  performers: byId(performers, performerIds).map((p) => ({
    as: null,
    performer: p,
  })),
  fingerprints: [
    { algorithm: 'PHASH', hash: `c0ffee${n}c0ffee${n}`, duration: 9 },
  ],
})

const scenes = [
  scene(
    's-sugar-rush',
    'Sugar Rush',
    1,
    'st-pop',
    ['p-gigi', 'p-mae'],
    ['t-candy', 't-bubblegum'],
  ),
  scene(
    's-cherry-pop',
    'Cherry Pop',
    2,
    'st-kitchen',
    ['p-bijou', 'p-trixie'],
    ['t-glossy', 't-sprinkles'],
  ),
  scene(
    's-sweet-tooth',
    'Sweet Tooth',
    3,
    'st-sugar',
    ['p-sherbet', 'p-gigi', 'p-trixie'],
    ['t-pastel', 't-sprinkles'],
  ),
  scene(
    's-lollipop-lane',
    'Lollipop Lane',
    4,
    'st-pop',
    ['p-mae'],
    ['t-candy', 't-glossy'],
  ),
]

export const catalogue = { scenes, performers, studios, tags }

// Demo-library entities that already carry a CandyDB StashID, by name (scenes
// by title). The rest are left for the Tagger to match.
export const LINKS = {
  performers: [
    ['Gumdrop Gigi', 'p-gigi'],
    ['Bonbon Bijou', 'p-bijou'],
  ],
  studios: [['Pop Club', 'st-pop']],
  tags: [['Candy', 't-candy']],
  scenes: [['Sugar Rush', 's-sugar-rush']],
}
