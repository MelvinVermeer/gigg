import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/songs/')({
  validateSearch: (search: Record<string, unknown>): { archived?: true } =>
    search.archived === true || search.archived === 'true' ? { archived: true } : {},
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listSongs', params.band, { archived: deps.archived }),
  component: Songs,
})

const bandRoute = getRouteApi('/$band')

function Songs() {
  const songs = Route.useLoaderData()
  const { archived } = Route.useSearch()
  const band = bandRoute.useLoaderData()
  const total = songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)

  return (
    <>
      <h1>{archived ? 'Archived songs' : 'Songs'}</h1>
      <p>
        {!archived && band.role === 'member' && (
          <>
            <Link to="/$band/songs/new" params={{ band: band.slug }}>
              Add song
            </Link>{' '}
            ·{' '}
          </>
        )}
        {archived ? (
          <Link to="/$band/songs" params={{ band: band.slug }}>
            Back to songs
          </Link>
        ) : (
          <Link to="/$band/songs" params={{ band: band.slug }} search={{ archived: true }}>
            Archived songs
          </Link>
        )}
      </p>
      {songs.length ? (
        <table className="songs">
          <thead>
            <tr>
              <th>Title</th>
              <th>Key</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((s) => (
              <tr key={s.slug}>
                <td>
                  <Link to="/$band/songs/$song" params={{ band: band.slug, song: s.slug }}>
                    {s.title}
                  </Link>
                </td>
                <td>{s.key}</td>
                <td>{formatDuration(s.durationSec)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>
                {songs.length} {songs.length === 1 ? 'song' : 'songs'}
              </td>
              <td />
              <td>{formatDuration(total)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p>{archived ? 'No archived songs.' : 'No songs yet.'}</p>
      )}
    </>
  )
}
