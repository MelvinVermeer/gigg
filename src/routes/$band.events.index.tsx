import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatDate, statusLabel } from '#/lib/date'
import { bandOp } from '#/server/fns'

type When = 'upcoming' | 'past' | 'archived'

export const Route = createFileRoute('/$band/events/')({
  validateSearch: (search: Record<string, unknown>): { when?: Exclude<When, 'upcoming'> } =>
    search.when === 'past' || search.when === 'archived' ? { when: search.when } : {},
  loaderDeps: ({ search }) => ({ when: search.when ?? ('upcoming' as When) }),
  loader: ({ params, deps }) => bandOp('listEvents', params.band, { when: deps.when }),
  component: Events,
})

const bandRoute = getRouteApi('/$band')
const headings = { upcoming: 'Upcoming events', past: 'Past events', archived: 'Archived events' }

function Events() {
  const events = Route.useLoaderData()
  const when = Route.useSearch().when ?? 'upcoming'
  const band = bandRoute.useLoaderData()
  const params = { band: band.slug }

  return (
    <>
      <h1>{headings[when]}</h1>
      <p>
        {band.role === 'member' && (
          <>
            <Link to="/$band/events/new" params={params}>
              Add event
            </Link>{' '}
            ·{' '}
          </>
        )}
        {when === 'upcoming' ? (
          <>
            <Link to="/$band/events" params={params} search={{ when: 'past' }}>
              Past events
            </Link>{' '}
            ·{' '}
            <Link to="/$band/events" params={params} search={{ when: 'archived' }}>
              Archived
            </Link>
          </>
        ) : (
          <Link to="/$band/events" params={params}>
            Upcoming events
          </Link>
        )}
      </p>
      {events.length ? (
        <ul className="events">
          {events.map((e) => (
            <li key={e.slug}>
              <span className="date">{formatDate(e.date)}</span>
              <Link to="/$band/events/$event" params={{ ...params, event: e.slug }}>
                {e.title}
              </Link>
              {e.venue && <span className="venue">{e.venue}</span>}
              <span className="status">
                {statusLabel(e.bookingStatus)}
                {e.paymentStatus !== 'open' && ` · ${statusLabel(e.paymentStatus)}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{when === 'upcoming' ? 'No upcoming events.' : `No ${when} events.`}</p>
      )}
    </>
  )
}
