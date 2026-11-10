import { Link, createFileRoute } from '@tanstack/react-router'
import { getBandPage } from '#/server/fns'

export const Route = createFileRoute('/$band')({
  loader: ({ params }) => getBandPage({ data: { band: params.band } }),
  component: BandPage,
})

const minutes = (sec: number | null) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`)

function BandPage() {
  const { band, songs } = Route.useLoaderData()
  return (
    <main>
      <h1>{band.name}</h1>
      <h2>Songs</h2>
      {songs.length ? (
        <ul>
          {songs.map((s) => (
            <li key={s.slug}>
              {s.title} {s.key && <small>({s.key})</small>} <small>{minutes(s.durationSec)}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No songs yet.</p>
      )}
      <p>
        <Link to="/settings">Settings</Link>
      </p>
    </main>
  )
}
