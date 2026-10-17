// The page at the root of the site: how to add the CandyBoudoir source and a
// card per plugin. It lives apart from site.mjs so a change to the page dates
// no plugin forward.
export const REPO = 'https://github.com/CandyBoudoir/candyboudoir.github.io'
const SOURCE = 'https://candyboudoir.github.io/index.yml'
const DEVELOP = 'https://candyboudoir.github.io/develop/index.yml'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

const card = (e) => `
      <li>
        <h2>${esc(e.title)} <span class="version">${esc(e.version.split('-')[0])}</span></h2>
        <p>${esc(e.description)}</p>
        <p class="links">
          <a href="${REPO}/tree/main/plugins/${esc(e.folder)}">README</a>${
            e.pages
              ? `\n          <a href="${esc(e.folder)}/">Live preview</a>`
              : ''
          }
        </p>
      </li>`

export function landing(entries) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CandyBoudoir plugins for Stash</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #150a2e;
        --card: #22123f;
        --line: #3d2466;
        --text: #fff2fa;
        --muted: #cdb6e0;
        --pink: #fc3d9f;
        --lime: #d7fa54;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg)
          radial-gradient(rgb(252 61 159 / 14%) 1px, transparent 1.5px) 0 0 /
          18px 18px;
        color: var(--text);
        font: 16px/1.6 system-ui, sans-serif;
      }
      main {
        max-width: 44rem;
        margin: 0 auto;
        padding: 3rem 1rem 4rem;
      }
      h1 {
        margin: 0 0 0.5rem;
        color: var(--pink);
        font-size: 2rem;
        line-height: 1.2;
      }
      h2 {
        margin: 0 0 0.25rem;
        font-size: 1.25rem;
      }
      a {
        color: var(--lime);
      }
      code {
        padding: 0.1rem 0.4rem;
        border: 1px solid var(--line);
        border-radius: 0.4rem;
        background: var(--card);
        overflow-wrap: anywhere;
      }
      ol {
        padding-left: 1.25rem;
      }
      .plugins {
        display: grid;
        gap: 1rem;
        margin: 2rem 0;
        padding: 0;
        list-style: none;
      }
      .plugins li {
        padding: 1rem 1.25rem;
        border: 1px solid var(--line);
        border-radius: 1rem;
        background: var(--card);
      }
      .plugins p {
        margin: 0.25rem 0;
      }
      .links a + a {
        margin-left: 1rem;
      }
      .version,
      .note {
        color: var(--muted);
      }
      .version {
        font-size: 0.875rem;
        font-weight: 400;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>CandyBoudoir plugins for Stash</h1>
      <p>
        Plugins for <a href="https://github.com/stashapp/stash">Stash</a>, the
        self-hosted media organizer. Add this source once and every
        CandyBoudoir plugin appears under Available Plugins.
      </p>
      <ol>
        <li>In Stash, open Settings &gt; Plugins &gt; Available Plugins and click Add source.</li>
        <li>
          Name <code>CandyBoudoir</code>, source URL <code>${SOURCE}</code>,
          local path <code>candyboudoir</code>.
        </li>
        <li>Expand the CandyBoudoir source, tick the plugins you want and click Install.</li>
      </ol>
      <p class="note">
        On a Stash develop build, use <code>${DEVELOP}</code> instead. Add one
        of the two sources, never both: they carry the same plugins.
      </p>
      <ul class="plugins">${entries.map(card).join('')}
      </ul>
      <p class="note">
        Built with Claude, Anthropic's AI coding assistant. Code, licenses and
        release notes are on <a href="${REPO}">GitHub</a>.
      </p>
    </main>
  </body>
</html>
`
}
