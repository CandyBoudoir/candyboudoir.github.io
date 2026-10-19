// A release as a card in Stash's own SceneCard markup (card grid-card
// scene-card, thumbnail section, card section, the date and a three-line
// description), so every theme styles it like a scene card. The cover and
// title open the release on the studio's own page in a new tab; the studio
// links to the user's studio, and the performers and tags add themselves
// to the filters. Stash lets videos play only from Stash itself, so there is
// no trailer: the studio's page has it.
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

// Stash's TruncatedText, which shows the rest on hover, or the text
// clamped to its lines where Stash has not registered it yet.
function Truncated({ text, lineCount, className }) {
  const { TruncatedText } = components
  if (TruncatedText)
    return (
      <TruncatedText text={text} lineCount={lineCount} className={className} />
    )
  return (
    <div
      className={`TruncatedText${className ? ` ${className}` : ''}`}
      style={{ WebkitLineClamp: lineCount }}
    >
      {text}
    </div>
  )
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
      <Truncated text={r.title || 'Untitled'} lineCount={2} />
    </h5>
  )
  return (
    <div
      className={`card grid-card scene-card zoom-${zoom} newreleases-card`}
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
          <span className="scene-card__date">{r.date}</span>
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
          {r.description ? (
            <Truncated
              className="scene-card__description"
              text={r.description}
              lineCount={3}
            />
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
