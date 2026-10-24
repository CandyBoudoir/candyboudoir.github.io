// Renders Juicy's own stickers on candy gradients as PNGs, for the demo
// library's portraits and the mock stash-box's images, so no test needs real
// pictures.
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ICONS = resolve('plugins/juicy/src/icons')

// Each spec: { key, icon, from, to, width, height, size }. The sticker is
// centred, `size` pixels square (half the shorter side by default). Returns
// { key: PNG buffer }.
export async function renderStickers(specs) {
  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL || undefined,
  })
  const page = await browser.newPage()
  const out = {}
  for (const { key, icon, from, to, width, height, size: s } of specs) {
    const svg = await readFile(join(ICONS, `${icon}.svg`), 'utf8')
    const size = s ?? Math.round(Math.min(width, height) / 2)
    await page.setViewportSize({ width, height })
    await page.setContent(
      `<body style="margin:0;height:${height}px;display:grid;place-items:center;
        background:radial-gradient(circle at 30% 25%, ${from}, ${to})">
        <div style="width:${size}px;height:${size}px">${svg}</div></body>`,
    )
    out[key] = await capture(page)
  }
  await browser.close()
  return out
}

// Chromium on a busy CI runner can refuse a capture ("Unable to capture
// screenshot"), which ended the Restash leg's setup once (PR #211) before
// any test ran. The next frame takes it, so try up to three times.
export async function capture(page, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await page.screenshot()
    } catch (e) {
      if (i >= tries || !/Unable to capture screenshot/.test(e.message)) throw e
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => done())),
      )
    }
  }
}
