// A release as a card in Stash's own SceneCard markup (card grid-card
// scene-card, thumbnail section, card section), so every theme styles it
// like a scene card. The cover and title open the release on the studio's
// own page in a new tab; the studio links to the user's studio, the badge to
// the scene that holds the release, and the performers and tags add
// themselves to the filters. Stash lets videos play only from Stash itself,
// so there is no trailer: the studio's page has it.
import { components, ReactRouterDOM } from '../api.js'

const { Link } = ReactRouterDOM

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' }

// Stash's timestamp style: 1:02:03, 12:34
export function fmtDuration(seconds) {
  if (!seconds || seconds < 0) return null
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

// A release date as the user's browser writes dates: Oct 18, 2026
export function fmtDate(date) {
  if (!date) return null
  const t = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(t)) return date
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// Stash shows a studio's logo over the cover, or its name when it has none.
function StudioOverlay({ studio }) {
  const logo =
    studio.image_path && !/[?&]default=true\b/.test(studio.image_path)
  return (
    <div className="studio-overlay">
      <Link to={`/studios/${studio.id}`}>
        {logo ? (
          <img
            className="image-thumbnail"
            loading="lazy"
            alt={studio.name}
            src={studio.image_path}
          />
        ) : (
          studio.name
        )}
      </Link>
    </div>
  )
}

function Title({ text }) {
  const { TruncatedText } = components
  return TruncatedText ? <TruncatedText text={text} lineCount={2} /> : text
}

const MAX_TAGS = 6

export function ReleaseCard({ release, width, zoom = 1, onPick }) {
  const r = release
  const duration = fmtDuration(r.duration)
  const cover = (
    <div className="scene-card-preview">
      {r.image ? (
        <img
          className="scene-card-preview-image"
          loading="lazy"
          src={r.image}
          alt=""
        />
      ) : null}
    </div>
  )
  const title = (
    <h5 className="card-section-title flex-aligned">
      <Title text={r.title || 'Untitled'} />
    </h5>
  )
  return (
    <div
      className={`card grid-card scene-card zoom-${zoom} newreleases-card${r.owner ? ' newreleases-owned' : ''}`}
      style={width ? { width: `${width}px` } : undefined}
      data-release={r.key}
    >
      <div className="thumbnail-section video-section">
        {r.url ? (
          <a
            href={r.url}
            className="scene-card-link"
            title="Open it on the studio's page"
            {...EXTERNAL}
          >
            {cover}
          </a>
        ) : (
          cover
        )}
        {duration ? (
          <div className="scene-specs-overlay">
            <span className="overlay-duration">{duration}</span>
          </div>
        ) : null}
        <StudioOverlay studio={r.studio} />
        {r.owner ? (
          <Link
            className="newreleases-owned-badge"
            to={`/scenes/${r.owner}`}
            title="Open your scene"
          >
            {/* a badge of its own, so it takes the theme's badge colours
                and not its link colour */}
            <span className="badge badge-primary">In your library</span>
          </Link>
        ) : null}
      </div>
      <div className="card-section">
        {r.url ? (
          <a href={r.url} {...EXTERNAL}>
            {title}
          </a>
        ) : (
          title
        )}
        <div className="scene-card__details">
          <span className="scene-card__date">{fmtDate(r.date)}</span>
          {r.performers.length ? (
            <div className="newreleases-performers">
              {r.performers.map((p, i) => (
                <span key={p.key}>
                  {i ? ', ' : null}
                  <button
                    type="button"
                    className="newreleases-performer"
                    title={`Only releases with ${p.name}`}
                    onClick={() => onPick?.('performers', p.key)}
                  >
                    {p.name}
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {r.url ? null : (
            <div className="text-muted newreleases-no-link">
              No link to the studio's page
            </div>
          )}
        </div>
        {r.tags.length ? (
          <div className="newreleases-tags">
            {r.tags.slice(0, MAX_TAGS).map((t) => (
              <button
                key={t.key}
                type="button"
                className="tag-item badge badge-secondary"
                title={`Only releases tagged ${t.name}`}
                onClick={() => onPick?.('tags', t.key)}
              >
                {t.name}
              </button>
            ))}
            {r.tags.length > MAX_TAGS ? (
              <span className="text-muted newreleases-more-tags">
                +{r.tags.length - MAX_TAGS}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
