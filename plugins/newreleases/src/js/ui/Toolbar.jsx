// The filters, in Stash's list toolbar with Stash's own react-select styling
// (className and classNamePrefix "react-select", as Stash's selects use), so
// each theme styles them as it styles Stash's. Performers and tags offer each
// name twice, under With and Without.
import { Bootstrap, FontAwesomeSolid, ReactSelect, components } from '../api.js'
import { DAY_WINDOWS, EMPTY, isFiltered } from '../data/filters.js'

const { Button, Form } = Bootstrap
const Select = ReactSelect.default ?? ReactSelect
const { faEyeSlash } = FontAwesomeSolid

// Stash's own option colour: its menus are white whatever the theme.
const styles = {
  option: (base) => ({ ...base, color: '#000' }),
  container: (base, state) => ({
    ...base,
    zIndex: state.isFocused ? 10 : base.zIndex,
  }),
}

const common = {
  className: 'react-select newreleases-select',
  classNamePrefix: 'react-select',
  isMulti: true,
  styles,
  noOptionsMessage: () => 'None',
  components: { IndicatorSeparator: () => null },
}

function StudioFilter({ favourites, value, onChange }) {
  const options = favourites.map((s) => ({
    value: String(s.id),
    label: s.name,
  }))
  return (
    <Select
      {...common}
      inputId="newreleases-studios"
      aria-label="Studios"
      placeholder="Studios"
      options={options}
      value={options.filter((o) => value.includes(o.value))}
      onChange={(list) => onChange((list || []).map((o) => o.value))}
    />
  )
}

// One select for a performer or tag filter: With and Without groups, and a
// pick in one group drops the same name from the other.
function PickFilter({ id, label, options, value, onChange }) {
  const byKey = new Map(options.map((o) => [o.key, o]))
  const option = (o, exclude) => ({
    value: `${exclude ? '-' : ''}${o.key}`,
    key: o.key,
    exclude,
    name: o.name,
    count: o.count,
  })
  const groups = [
    { label: 'With', options: options.map((o) => option(o, false)) },
    { label: 'Without', options: options.map((o) => option(o, true)) },
  ]
  const selected = value.map((p) =>
    option(
      byKey.get(p.key) || { key: p.key, name: p.key.replace(/^~/, '') },
      p.exclude,
    ),
  )
  return (
    <Select
      {...common}
      inputId={id}
      aria-label={label}
      placeholder={label}
      options={groups}
      value={selected}
      getOptionLabel={(o) => o.name}
      formatOptionLabel={(o, { context }) =>
        context === 'value' ? (
          o.exclude ? (
            <span className="newreleases-without">without {o.name}</span>
          ) : (
            o.name
          )
        ) : (
          <span>
            {o.name}{' '}
            {o.count ? <span className="text-muted">{o.count}</span> : null}
          </span>
        )
      }
      onChange={(list) => {
        const out = []
        for (const o of list || []) {
          const at = out.findIndex((p) => p.key === o.key)
          if (at >= 0) out.splice(at, 1)
          out.push({ key: o.key, exclude: o.exclude })
        }
        onChange(out)
      }}
    />
  )
}

export function Toolbar({
  favourites,
  performerOptions,
  tagOptions,
  filters,
  onChange,
}) {
  const { Icon } = components
  const set = (part) => onChange({ ...filters, ...part })
  return (
    <div className="filtered-list-toolbar newreleases-toolbar">
      <div className="newreleases-filter">
        <StudioFilter
          favourites={favourites}
          value={filters.studios}
          onChange={(studios) => set({ studios })}
        />
      </div>
      <div className="newreleases-filter">
        <PickFilter
          id="newreleases-performers"
          label="Performers"
          options={performerOptions}
          value={filters.performers}
          onChange={(performers) => set({ performers })}
        />
      </div>
      <div className="newreleases-filter">
        <PickFilter
          id="newreleases-tags"
          label="Tags"
          options={tagOptions}
          value={filters.tags}
          onChange={(tags) => set({ tags })}
        />
      </div>
      <div className="newreleases-window">
        <Form.Control
          as="select"
          className="btn-secondary"
          aria-label="Released"
          value={filters.days}
          onChange={(e) => set({ days: Number(e.target.value) })}
        >
          {DAY_WINDOWS.map((w) => (
            <option key={w.days} value={w.days}>
              {w.label}
            </option>
          ))}
        </Form.Control>
      </div>
      <Button
        variant="secondary"
        className="newreleases-hide-owned"
        active={filters.hideOwned}
        aria-pressed={filters.hideOwned}
        onClick={() => set({ hideOwned: !filters.hideOwned })}
      >
        {Icon ? <Icon icon={faEyeSlash} /> : null} <span>Hide what I have</span>
      </Button>
      {isFiltered(filters) ? (
        <Button
          variant="secondary"
          className="newreleases-clear"
          onClick={() => onChange(EMPTY)}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
