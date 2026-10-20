// The filters, in Stash's list toolbar with Stash's own react-select styling
// (className and classNamePrefix "react-select", as Stash's selects use), so
// each theme styles them as it styles Stash's. Performers and tags offer each
// name twice, under With and Without. The order is Stash's sort menu and
// direction button, and the page size is Stash's select, with Stash's sizes.
import {
  Bootstrap,
  components,
  FontAwesomeSolid,
  React,
  ReactSelect,
} from '../api.js'
import { EMPTY, isFiltered, PAGE_SIZES } from '../data/filters.js'
import { newSeed, SORTS } from '../data/sort.js'

const {
  Button,
  ButtonGroup,
  Dropdown,
  Form,
  InputGroup,
  OverlayTrigger,
  Tooltip,
} = Bootstrap
const { faCaretDown, faCaretUp, faRandom } = FontAwesomeSolid
const Select = ReactSelect.default ?? ReactSelect

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
// pick in one group drops the same name from the other. While its menu is
// open it keeps the names it opened with, so a running check's arrivals
// never move them under the pointer.
function PickFilter({ id, label, options, value, onChange }) {
  const [opened, setOpened] = React.useState(null)
  const listed = opened ?? options
  const byKey = new Map(options.map((o) => [o.key, o]))
  const option = (o, exclude) => ({
    value: `${exclude ? '-' : ''}${o.key}`,
    key: o.key,
    exclude,
    name: o.name,
    count: o.count,
  })
  const groups = [
    { label: 'With', options: listed.map((o) => option(o, false)) },
    { label: 'Without', options: listed.map((o) => option(o, true)) },
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
      onMenuOpen={() => setOpened(options)}
      onMenuClose={() => setOpened(null)}
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

// Stash's sort menu and direction button (List/ListFilter.tsx's
// SortBySelect, which Stash does not hand to plugins), with its reshuffle
// button under Random. As in Stash, a new sort keeps the direction, and
// Random and Reshuffle take a new seed.
function SortBy({ sortBy, sortDir, onChange }) {
  const { Icon } = components
  const icon = (i) => (Icon ? <Icon icon={i} /> : null)
  const current = SORTS.find((s) => s.value === sortBy)
  const ascending = sortDir === 'asc'
  const pick = (value) =>
    onChange({
      sortBy: value,
      seed: value === 'random' ? newSeed() : null,
    })
  return (
    <Dropdown as={ButtonGroup} className="sort-by-select">
      <InputGroup.Prepend>
        <Dropdown.Toggle variant="secondary">{current?.label}</Dropdown.Toggle>
      </InputGroup.Prepend>
      <Dropdown.Menu className="bg-secondary text-white">
        {SORTS.map((s) => (
          <Dropdown.Item
            key={s.value}
            className="bg-secondary text-white"
            eventKey={s.value}
            data-value={s.value}
            onSelect={() => pick(s.value)}
          >
            {s.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
      <OverlayTrigger
        overlay={
          <Tooltip id="newreleases-sort-direction">
            {ascending ? 'Ascending' : 'Descending'}
          </Tooltip>
        }
      >
        <Button
          variant="secondary"
          aria-label={ascending ? 'Ascending' : 'Descending'}
          onClick={() => onChange({ sortDir: ascending ? 'desc' : 'asc' })}
        >
          {icon(ascending ? faCaretUp : faCaretDown)}
        </Button>
      </OverlayTrigger>
      {sortBy === 'random' ? (
        <OverlayTrigger
          overlay={<Tooltip id="newreleases-sort-reshuffle">Reshuffle</Tooltip>}
        >
          <Button
            variant="secondary"
            aria-label="Reshuffle"
            onClick={() => onChange({ seed: newSeed() })}
          >
            {icon(faRandom)}
          </Button>
        </OverlayTrigger>
      ) : null}
    </Dropdown>
  )
}

// Stash's page size select (List/ListFilter.tsx's PageSizeSelector), with
// a size from the address that is not one of Stash's listed in its order.
function PageSize({ value, onChange }) {
  const sizes = PAGE_SIZES.includes(value)
    ? PAGE_SIZES
    : [...PAGE_SIZES, value].sort((a, b) => a - b)
  return (
    <div className="page-size-selector">
      <Form.Control
        as="select"
        className="btn-secondary"
        aria-label="Per page"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {sizes.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Form.Control>
    </div>
  )
}

export function Toolbar({
  favourites,
  performerOptions,
  tagOptions,
  filters,
  onChange,
}) {
  // A new filter or order starts again at its first page; the page size
  // stays
  const set = (part) => onChange({ ...filters, ...part, page: 1 })
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
      <SortBy
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onChange={set}
      />
      <PageSize
        value={filters.perPage}
        onChange={(perPage) => set({ perPage })}
      />
      {isFiltered(filters) ? (
        <Button
          variant="secondary"
          className="newreleases-clear"
          onClick={() =>
            onChange({
              ...EMPTY,
              sortBy: filters.sortBy,
              sortDir: filters.sortDir,
              seed: filters.seed,
              perPage: filters.perPage,
            })
          }
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
