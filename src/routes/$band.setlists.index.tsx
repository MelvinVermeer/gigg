import { Link, createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/setlists/')({
  loader: ({ params }) => bandOp('listSetlists', params.band, {}),
  component: Setlists,
})

const bandRoute = getRouteApi('/$band')

/** Setlists not tied to an event: a standard show, a festival set. Events start from a copy. */
function Setlists() {
  const setlists = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const { id } = await bandOp('createSetlist', band.slug, { name })
    await navigate({ to: '/$band/setlists/$setlist', params: { band: band.slug, setlist: id } })
  }

  return (
    <>
      <h1>Setlists</h1>
      <p>Setlists you reuse, like your standard show. A new event can start from a copy of one.</p>
      {band.role === 'member' && (
        <form className="row" onSubmit={create}>
          <input aria-label="New setlist name" placeholder="e.g. Standard 2 sets" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create setlist</button>
        </form>
      )}
      {setlists.length ? (
        <ul className="records">
          {setlists.map((s) => (
            <li key={s.id} className={s.archivedAt ? 'archived' : undefined}>
              <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: s.id }}>
                <strong>{s.name}</strong>
              </Link>
              {s.archivedAt && <small> (archived)</small>}
              <br />
              <small>
                {s.songs} songs · {formatDuration(s.durationSec) || '0:00'}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No setlists yet.</p>
      )}
    </>
  )
}
