// Cherry Pick's test helpers, on top of the ones every plugin shares. Cherry
// Pick needs a library with ratings and plays, so its specs seed the demo
// library (demo-library.mjs) next to the shared one and remove it after.
import {
  colorAt,
  demoIds,
  gql,
  progressColors,
  setPluginSettings,
  usePlugins,
} from '../../../tests/stash/helpers.mjs'
import {
  DEMO,
  MARK,
  SPARSE,
  removeDemoLibrary,
  seedDemoLibrary,
} from './demo-library.mjs'

export * from '../../../tests/stash/helpers.mjs'
export { DEMO, SPARSE }

export const PLUGIN_ID = 'CherryPick'

// Cherry Pick alone, with a fresh configuration and the demo library (or
// the sparse one). Returns the shared library's ids (read before the demo
// library adds its own, since demoIds picks the first scene and performer
// it finds) and the demo library's. Both take no arguments: specs pass them
// to beforeAll, which reads a first parameter as fixtures.
async function setUp(sparse) {
  await usePlugins(PLUGIN_ID)
  await setPluginSettings(PLUGIN_ID, {})
  await removeDemoLibrary(gql)
  const shared = await demoIds()
  return { shared, demo: await seedDemoLibrary(gql, { sparse }) }
}
export const setUpCherryPick = () => setUp(false)
export const setUpSparseCherryPick = () => setUp(true)

// The shared clips' scenes, for Don't learn: they are all rated, and the
// sparse library's specs keep their ratings out of the model.
export async function sharedScenes() {
  const { findScenes } = await gql(
    '{ findScenes(filter: { per_page: -1 }) { scenes { id title details } } }',
  )
  return findScenes.scenes.filter((s) => s.details !== MARK)
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

// The bracket in progress as Stash's plugin configuration holds it, once
// its debounced save lands: 'playing', 'paused', or null for none
export async function savedBracketStatus() {
  const b = (await pluginConfig())?.bracket
  return b ? (JSON.parse(b)?.status ?? null) : null
}

// A finished 16-performer bracket, as the plugin stores it: its champion and
// finalist get a crown and a medal.
export function finishedBracket(champion, finalist) {
  return {
    id: 'btest',
    kind: 'performer',
    gender: 'FEMALE',
    poolLabel: 'Female',
    size: 16,
    champions: false,
    seeds: [],
    decisions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:20:00.000Z',
    status: 'done',
    result: {
      champion,
      finalist,
      semifinalists: [],
      quarterfinalists: [],
    },
  }
}

// A demo scene by what it is: rated or not, played or not, in the demo plan
// (or the sparse one).
export function demoScene(ids, { rated, played }, plan = DEMO) {
  const s = plan.scenes.find(
    (x) => !!x.rating100 === rated && !!x.plays.length === played,
  )
  return ids.scenes[s.title]
}

// Apply bracket ratings automatically, set as the user would. Off, the
// champion screen offers Apply to my ratings and its preview; on, closing
// the screen sets the ratings. Set it before the page loads.
export async function setAutoApply(on) {
  await setPluginSettings(PLUGIN_ID, {
    ...((await pluginConfig()) || {}),
    autoApply: on,
  })
}

// The demo performers a bracket counts as candidates: no rating of their
// own (with ownRatings false, as if every performer were unrated) and fewer
// than two rated scenes, which would anchor them at their average
export function demoCandidates({ ownRatings = true } = {}, plan = DEMO) {
  const ratedScenes = (name) =>
    plan.scenes.filter(
      (s) => s.performers.includes(name) && s.rating100 != null,
    ).length
  return new Set(
    plan.performers
      .filter((p) => !(ownRatings && p.rating100 != null))
      .filter((p) => ratedScenes(p.name) < 2)
      .map((p) => p.name),
  )
}

// One bracket pick with the keyboard: the candidate when one meets a rated
// performer, else the left side, so every candidate gets past its first
// match against a rated one and Apply always has a row to show
export async function pickCandidate(page, play, candidates) {
  const [a, b] = await play
    .locator('.cherrypick-contender .cherrypick-cont-title')
    .allInnerTexts()
  await page.keyboard.press(
    candidates.has(b) && !candidates.has(a) ? 'ArrowRight' : 'ArrowLeft',
  )
}

// The For you row is there once the library and the model are in.
export const forYouCards = (page) =>
  page.locator(
    '.cherrypick-for-you .slick-slide:not(.slick-cloned) .scene-card',
  )

// ------------------------------------------------- for the themes' checks

// Starts a 16-performer bracket from the Performers list and returns its
// play dialog once the opening banner has gone
export async function openPerformerBracket(page) {
  await page.goto('/performers')
  const bracket = page
    .locator('.cherrypick-bracket-button')
    .filter({ visible: true })
    .first()
  await bracket.waitFor({ timeout: 20_000 })
  await bracket.click()
  const play = page.locator('.cherrypick-play-modal')
  await play.locator('.cherrypick-contender').first().waitFor()
  await play.locator('.cherrypick-banner').waitFor({ state: 'hidden' })
  return play
}

// Abandons the bracket a play dialog shows (asking first, unless the
// question is open), and waits for Stash's plugin configuration to drop it
// (a debounced save that then waits for the page to settle, at most 11 s),
// so the next test's list offers a new bracket instead of resuming this one
export async function abandonBracket(play) {
  const confirm = play.locator('.modal-footer .btn-danger')
  if (!(await confirm.isVisible()))
    await play.getByRole('button', { name: 'Abandon', exact: true }).click()
  await confirm.click()
  await play.waitFor({ state: 'detached' })
  for (let i = 0; i < 75 && (await pluginConfig())?.bracket != null; i++)
    await new Promise((r) => setTimeout(r, 200))
}

// What a button in a bracket dialog's header shows, with the pointer off it
// and its transitions over: its ink, its mark's colour (an icon, or the
// close button's ×), the colour on screen beside the mark (halfway to the
// button's edge, at the mark's middle) and its width
export async function headerButtonLook(page, button, mark = 'svg') {
  await page.mouse.move(0, 0)
  await button.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  const icon = button.locator(mark)
  const box = await button.boundingBox()
  const at = await icon.boundingBox()
  return {
    ink: await button.evaluate((el) => getComputedStyle(el).color),
    icon: await icon.evaluate((el) => getComputedStyle(el).color),
    behind: await colorAt(page, (box.x + at.x) / 2, at.y + at.height / 2),
    width: box.width,
  }
}

// What the map size No map shows while pointed at, or reached with the
// keyboard (Shift+Tab from Short map), when it isn't the size picked: the
// colour on screen beside its mark, read as headerButtonLook reads it, and
// the mark's line in its ink at its opacity over that colour. The line is
// 2 units of the mark's 12, under 2px in a theme with smaller buttons, so
// no pixel of the screen is sure to lie inside it.
export async function sizeMarkLook(page, play, by) {
  const size = (name) =>
    play.getByRole('group', { name: 'Map size' }).getByRole('button', { name })
  const button = size('No map')
  if ((await button.getAttribute('aria-pressed')) !== 'false')
    throw new Error('No map is the size picked')
  if (by === 'keyboard') {
    await page.mouse.move(0, 0)
    await size('Short map').focus()
    await page.keyboard.press('Shift+Tab')
    if (!(await button.evaluate((el) => el.matches(':focus-visible'))))
      throw new Error('No map has no keyboard focus')
  } else await button.hover()
  await button.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  const box = await button.boundingBox()
  const at = await button.locator('svg').boundingBox()
  const behind = await colorAt(page, (box.x + at.x) / 2, at.y + at.height / 2)
  const mark = await button.locator('svg rect').evaluate((line, under) => {
    let alpha = 1
    for (let el = line; el !== line.closest('button'); el = el.parentElement)
      alpha *= Number(getComputedStyle(el).opacity)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = under
    ctx.fillRect(0, 0, 1, 1)
    ctx.globalAlpha = alpha
    ctx.fillStyle = getComputedStyle(line).fill
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }, behind)
  return { mark, behind }
}

// The colours a bracket's progress bar shows on screen, in its filled part
// and near the end of its empty groove
export const progressLook = (page, play) =>
  progressColors(page, play.locator('.cherrypick-progress'))
