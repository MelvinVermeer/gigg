import { Link, createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'

export const Route = createFileRoute('/$band/setlists/')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listSetlists', params.band, { archived: deps.archived }),
  component: Setlists,
})

const bandRoute = getRouteApi('/$band')

/** Setlists not tied to an event: a standard show, a festival set. Events start from a copy. */
function Setlists() {
  const setlists = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const { archived } = Route.useSearch()

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const { id } = await bandOp('createSetlist', band.slug, { name })
    await navigate({ to: '/$band/setlists/$setlist', params: { band: band.slug, setlist: id } })
  }

  return (
    <>
      <h1>{archived ? 'Archived setlists' : 'Setlists'}</h1>
      {archived ? (
        <p>
          <Link to="/$band/setlists" params={{ band: band.slug }}>
            Back to setlists
          </Link>
        </p>
      ) : (
        <p>Setlists you reuse, like your standard show. A new event can start from a copy of one.</p>
      )}
      {!archived && band.role === 'member' && (
        <form className="row" onSubmit={create}>
          <input aria-label="New setlist name" placeholder="e.g. Standard 2 sets" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create setlist</button>
        </form>
      )}
      {setlists.length ? (
        <ul className="records">
          {setlists.map((s) => (
            <li key={s.id}>
              <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: s.id }}>
                <strong>{s.name}</strong>
              </Link>
              <br />
              <small>
                {s.songs} songs · {formatDuration(s.durationSec) || '0:00'}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p>{archived ? 'No archived setlists.' : 'No setlists yet.'}</p>
      )}
      {!archived && (
        <ul className="records">
          <li>
            <Link to="/$band/songs" params={{ band: band.slug }}>
              <strong>All songs</strong>
            </Link>
          </li>
        </ul>
      )}
    </>
  )
}
