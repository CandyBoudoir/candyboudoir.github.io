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

// ---------------------------------------------------------------- StashDB

// A stand-in for StashDB, for Cherry Pick's StashDB layer (its lookups go to
// https://stashdb.org/graphql, which its tests answer from this mock). Its
// own invented performers, studios and scenes, which nothing else reads, so
// the themes' Tagger and scrape screenshots never see them. Each scene has a
// hidden `popularity`, the number of users holding it, which orders
// POPULARITY queries as StashDB's distinct fingerprint submitters do; its
// OSHASH submissions add up to that number.
// Keys the mock refuses, as StashDB refuses an expired one; any other key
// passes (the shared library's CandyDB key is 'demo').
export const REFUSED_KEY = /^invalid/

const sdbPerformer = (id, name, gender) => ({
  id,
  name,
  disambiguation: null,
  gender,
  aliases: [],
})
const coco = sdbPerformer('sdb-p-coco', 'Caramel Coco', 'FEMALE')
const nova = sdbPerformer('sdb-p-nova', 'Nougat Nova', 'FEMALE')
const milo = sdbPerformer('sdb-p-milo', 'Maple Milo', 'MALE')

const confection = { id: 'sdb-st-confection', name: 'Confection Network' }
const fudge = { id: 'sdb-st-fudge', name: 'Fudge Factory', parent: confection }
const toffee = { id: 'sdb-st-toffee', name: 'Toffee Lane', parent: null }

// Tag names match the shared demo library's, so Cherry Pick maps them.
const sdbTags = ['Candy', 'Glossy', 'Pastel', 'Sparkle', 'Retro'].map(
  (name) => ({ id: `sdb-t-${name.toLowerCase()}`, name }),
)

// [title, users holding it, performers, studio]
const SDB_SCENES = [
  ['Butterscotch Bay', 420, [coco], fudge],
  ['Marshmallow Mile', 35, [coco, nova], toffee],
  ['Gumball Garden', 980, [coco], fudge],
  ['Licorice Loop', 150, [coco, milo], toffee],
  ['Truffle Terrace', 610, [coco], fudge],
  ['Meringue Manor', 12, [coco, nova], toffee],
  ['Brittle Bridge', 75, [coco], fudge],
  ['Fondant Falls', 530, [coco, milo], toffee],
  ['Praline Park', 260, [coco], fudge],
  ['Sorbet Shore', 0, [coco, nova], toffee],
  ['Gummy Gazebo', 840, [coco], fudge],
  ['Jellybean Junction', 190, [coco], toffee],
  ['Bonbon Boulevard', 330, [coco, milo], fudge],
  ['Cocoa Cove', 55, [coco, nova], toffee],
  ['Wafer Way', 700, [coco], fudge],
  ['Sherbet Street', 95, [coco], toffee],
  ['Nougat Nook', 480, [coco, nova], fudge],
  ['Toffee Trail', 20, [coco], toffee],
  ['Caramel Canyon', 300, [nova], fudge],
  ['Fudge Fountain', 640, [nova], fudge],
  ['Maple Meadow', 110, [milo], toffee],
  ['Candy Crossing', 45, [nova, milo], toffee],
]

// StashDB's category for the stores and tubes a scene is sold or shown on
const STORES = { name: 'Content distribution platforms' }

const LANDSCAPE = ['sugar-rush', 'cherry-pop', 'sweet-tooth', 'lollipop-lane']
const hash = (n, salt) =>
  ((n + 1) * 2654435761 + salt).toString(16).padStart(16, '0').slice(-16)

const stashdbScenes = SDB_SCENES.map(([title, popularity, cast, studio], i) => {
  const id = `sdb-s-${title.toLowerCase().replace(/\W+/g, '-')}`
  const key = LANDSCAPE[i % LANDSCAPE.length]
  // two encodes, so OSHASH submissions are spread over two hashes
  const first = Math.ceil(popularity * 0.6)
  return {
    id,
    title,
    release_date: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${String(10 + i).padStart(2, '0')}`,
    date: null,
    duration: 600 + i * 37,
    code: `SDB-${String(i + 1).padStart(3, '0')}`,
    details: `${title}, invented for Cherry Pick's tests.`,
    images: [image(key, 640, 360)],
    studio: { ...studio, parent: studio.parent ?? null },
    performers: cast.map((p) => ({ as: null, performer: p })),
    tags: [sdbTags[i % 5], sdbTags[(i + 2) % 5]],
    // Fudge Factory's scenes link to the studio's page, with tracking
    // parameters Cherry Pick must drop; Toffee Lane's to a clip store,
    // after a Wayback Machine copy that StashDB files under the store too
    urls:
      studio === toffee
        ? [
            {
              url: `https://web.archive.org/web/2025/https://clips.example/clip/${id}`,
              site: { name: 'Candy Clips', category: STORES },
            },
            {
              url: `https://clips.example/clip/${id}?aff=candy`,
              site: { name: 'Candy Clips', category: STORES },
            },
          ]
        : [
            {
              url: `https://example.com/scenes/${id}?ats=candy&utm_source=stashdb`,
              type: 'STUDIO',
              site: { name: 'Studio', category: { name: 'Primary sources' } },
            },
          ],
    fingerprints: [
      {
        algorithm: 'OSHASH',
        hash: hash(i, 1),
        duration: 600,
        submissions: first,
      },
      {
        algorithm: 'OSHASH',
        hash: hash(i, 2),
        duration: 600,
        submissions: popularity - first,
      },
      {
        algorithm: 'PHASH',
        hash: hash(i, 3),
        duration: 600,
        submissions: Math.round(popularity / 3),
      },
    ].filter((f) => f.submissions > 0),
    popularity,
  }
})

export const STASHDB = {
  scenes: stashdbScenes,
  performers: [coco, nova, milo],
  studios: [confection, fudge, toffee],
  tags: sdbTags,
}
