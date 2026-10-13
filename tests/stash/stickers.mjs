// Renders Juicy's own stickers on candy gradients as PNGs, for the demo
// library's portraits and the mock stash-box's images, so no test needs real
// pictures.
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ICONS = resolve('src/icons')

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
    out[key] = await page.screenshot()
  }
  await browser.close()
  return out
}
