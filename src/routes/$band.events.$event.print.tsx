import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatDate } from '#/lib/date'
import { stageFontMm } from '#/lib/stage'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/$event/print')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Print,
})

const bandRoute = getRouteApi('/$band')

/** Stage-floor setlist: one page per set, big titles only. Print it or save it as PDF. */
function Print() {
  const { event, sets } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  return (
    <>
      <p className="no-print">
        <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }}>
          ← Setlist
        </Link>{' '}
        <button type="button" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </p>
      {sets.map((set, i) => (
        <section key={i} className="stage-page">
          <header>
            <strong>{set.name}</strong> · {event.title} · {formatDate(event.date)}
          </header>
          <ol style={{ fontSize: `${stageFontMm(set.songs.map((s) => s.title))}mm` }}>
            {set.songs.map((song, j) => (
              <li key={j}>
                {song.title}
                {song.key && <small> {song.key}</small>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  )
}
