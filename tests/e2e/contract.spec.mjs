// Checks that Stash still renders the elements Juicy styles and that Juicy's
// CSS, JavaScript and settings take effect.
import { expect, test } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  CHEEKY_EMPTY_LINE,
  EMPTY_LIST,
  PAGES,
  demoIds,
  setPlugin,
  setSfw,
} from './stash.mjs'

let ids
test.beforeAll(async () => {
  ids = await demoIds()
})
const url = (path) =>
  path.replace(':scene', ids.scene).replace(':performer', ids.performer)

for (const [name, path, ready, selectors] of PAGES) {
  test(`${name}: Stash renders the elements Juicy styles`, async ({ page }) => {
    await page.goto(url(path))
    await page.locator(ready).filter({ visible: true }).first().waitFor()
    for (const selector of selectors) {
      await expect.soft(page.locator(selector).first(), selector).toBeAttached()
    }
  })
}

test('Juicy loads: class, colours, font and heart ratings', async ({
  page,
}) => {
  await page.goto(url('/scenes/:scene'))
  await page.locator('.rating-stars').waitFor()
  await expect(page.locator('html')).toHaveClass(/\bjuicy\b/)
  const look = await page.evaluate(async () => {
    await document.fonts.ready
    const star = document.querySelector('.rating-stars button svg')
    const style = star && getComputedStyle(star)
    return {
      background: getComputedStyle(document.body).backgroundColor,
      fredoka: document.fonts.check('600 16px "Juicy Fredoka"'),
      starMask: style ? style.maskImage || style.webkitMaskImage : '',
    }
  })
  expect(look.background).toBe('rgb(21, 10, 46)')
  expect(look.fredoka).toBe(true)
  expect(look.starMask).toContain('glyph-heart')
})

test('an empty list gets the cheeky line', async ({ page }) => {
  await page.goto(EMPTY_LIST)
  await expect(page.locator('.paginationIndex')).toHaveAttribute(
    'data-juicy-empty',
    CHEEKY_EMPTY_LINE,
  )
})

test('Calm mode and Plain labels take effect', async ({ page }) => {
  try {
    await setPlugin({ calmMode: true, plainCopy: true })
    await page.goto(EMPTY_LIST)
    await expect(page.locator('html')).toHaveClass(/\bjuicy-calm\b/)
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-juicy-empty',
      '',
    )
  } finally {
    await setPlugin({ calmMode: false, plainCopy: false })
  }
})

test('SFW mode drops the cheek', async ({ page }) => {
  try {
    await setSfw(true)
    await page.goto(EMPTY_LIST)
    await expect(page.locator('.sfw-content-mode').first()).toBeAttached()
    await expect(page.locator('.paginationIndex')).toHaveAttribute(
      'data-juicy-empty',
      '',
    )
  } finally {
    await setSfw(false)
  }
})

// Not a pass/fail check: lists the Stash classes in juicy.css that no visited
// page renders, and which of them still rendered on the baseline Stash version
// (tests/e2e/unmatched-baseline.txt). Those newly missing classes point at what
// a Stash change removed; the rest only appear in dialogs, menus or on hover.
test('report Stash classes Juicy styles that no page renders', async ({
  page,
}, info) => {
  const css = (await readFile('dist/site/Theme-Juicy/juicy.css', 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')
  const classes = [
    ...new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])),
  ].filter((c) => !c.startsWith('juicy'))
  const seen = new Set()
  for (const [, path, ready] of [
    ...PAGES,
    ['empty', EMPTY_LIST, '.paginationIndex'],
  ]) {
    await page.goto(url(path))
    await page.locator(ready).filter({ visible: true }).first().waitFor()
    for (const c of await page.evaluate(
      (list) => list.filter((c) => document.getElementsByClassName(c).length),
      classes,
    )) {
      seen.add(c)
    }
  }
  const unmatched = classes.filter((c) => !seen.has(c)).sort()
  const baseline = (
    await readFile('tests/e2e/unmatched-baseline.txt', 'utf8').catch(() => '')
  )
    .split('\n')
    .filter(Boolean)
  const newlyMissing = baseline.length
    ? unmatched.filter((c) => !baseline.includes(c))
    : []
  await mkdir('test-results', { recursive: true })
  await writeFile(
    'test-results/unmatched-classes.txt',
    unmatched.join('\n') + '\n',
  )
  await writeFile(
    'test-results/newly-missing-classes.txt',
    newlyMissing.join('\n'),
  )
  await info.attach('newly-missing-classes', {
    body: newlyMissing.join('\n') || '(none)',
    contentType: 'text/plain',
  })
})
