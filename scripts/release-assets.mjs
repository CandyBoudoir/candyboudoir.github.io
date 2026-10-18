// The stable channel serves each plugin's zip from its GitHub Release, so the
// release's download count tracks installs and updates. Reading an asset's
// digest through the API leaves that count alone; downloading the asset would
// add to it on every publish, so the build and its checks never download one.
// A plugin from another CandyBoudoir repo (external.mjs) has its release, and
// its zip, in that repo.
import { REPO } from './landing.mjs'

const HUB = new URL(REPO).pathname.slice(1)
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const ASSET =
  /^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/

export const assetURL = (tag, name, repo = HUB) =>
  `https://github.com/${repo}/releases/download/${tag}/${name}`

export const isAssetURL = (path) => ASSET.test(path)

// The sha256 GitHub recorded for the asset an assetURL points at.
export async function assetDigest(url) {
  const [, repo, tag, name] = url.match(ASSET)
  const res = await fetch(
    `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
    { headers: token ? { authorization: `Bearer ${token}` } : {} },
  )
  if (!res.ok)
    throw new Error(`${repo} release ${tag}: GitHub answered ${res.status}`)
  const asset = (await res.json()).assets.find((a) => a.name === name)
  if (!asset) throw new Error(`${repo} release ${tag} has no ${name}`)
  return asset.digest?.replace(/^sha256:/, '')
}
