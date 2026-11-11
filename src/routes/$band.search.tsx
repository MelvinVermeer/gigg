import { Link, createFileRoute } from '@tanstack/react-router'
import { bandOp } from '#/server/fns'
import type { SearchResult } from '#/server/ops'

export const Route = createFileRoute('/$band/search')({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === 'string' && search.q ? { q: search.q } : {},
  loaderDeps: ({ search }) => ({ q: search.q ?? '' }),
  loader: ({ params, deps }) => bandOp('search', params.band, { q: deps.q }),
  component: Search,
})

const groups: { type: SearchResult['type']; title: string }[] = [
  { type: 'song', title: 'Songs' },
  { type: 'event', title: 'Events' },
  { type: 'venue', title: 'Venues' },
  { type: 'contact', title: 'Contacts' },
]

function ResultLink({ band, r }: { band: string; r: SearchResult }) {
  switch (r.type) {
    case 'song':
      return <Link to="/$band/songs/$song" params={{ band, song: r.ref }}>{r.label}</Link>
    case 'event':
      return <Link to="/$band/events/$event" params={{ band, event: r.ref }}>{r.label}</Link>
    case 'venue':
      return <Link to="/$band/settings/venues" params={{ band }} hash={r.ref}>{r.label}</Link>
    case 'contact':
      return <Link to="/$band/settings/contacts" params={{ band }} hash={r.ref}>{r.label}</Link>
  }
}

function Search() {
  const results = Route.useLoaderData()
  const { q = '' } = Route.useSearch()
  const { band } = Route.useParams()

  return (
    <>
      <h1>Search</h1>
      {!q && <p>Type in the search box above.</p>}
      {q && !results.length && <p>Nothing found for “{q}”.</p>}
      {groups.map(({ type, title }) => {
        const hits = results.filter((r) => r.type === type)
        if (!hits.length) return null
        return (
          <section key={type}>
            <h2>{title}</h2>
            <ul className="results">
              {hits.map((r) => (
                <li key={r.ref}>
                  <ResultLink band={band} r={r} />
                  {r.detail && <small> · {r.detail}</small>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
