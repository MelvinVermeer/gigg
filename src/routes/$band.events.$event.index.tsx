import { Link, createFileRoute, getRouteApi, redirect, useRouter } from '@tanstack/react-router'
import { formatDate, statusLabel } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/$event/')({
  loader: async ({ params }) => {
    const res = await bandOp('getEvent', params.band, { slug: params.event })
    if (res.moved) throw redirect({ to: '/$band/events/$event', params: { ...params, event: res.slug } })
    return res
  },
  component: Event,
})

const bandRoute = getRouteApi('/$band')

function Event() {
  const { event, venue, contacts, setlist } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const params = { band: band.slug, event: event.slug }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveEvent' : 'restoreEvent', band.slug, { slug: event.slug })
    await router.invalidate()
  }

  return (
    <>
      <h1>{event.title}</h1>
      {event.archivedAt && <p role="status">This event is archived.</p>}
      <dl className="fields">
        <dt>Date</dt>
        <dd>{formatDate(event.date)}</dd>
        <dt>Venue</dt>
        <dd>
          {venue ? (
            <>
              {venue.name}
              {venue.address && (
                <>
                  <br />
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}>
                    {venue.address}
                  </a>
                </>
              )}
            </>
          ) : (
            '–'
          )}
        </dd>
        <dt>Booking</dt>
        <dd>{statusLabel(event.bookingStatus)}</dd>
        <dt>Payment</dt>
        <dd>{statusLabel(event.paymentStatus)}</dd>
        <dt>Contacts</dt>
        <dd>
          {contacts.length
            ? contacts.map((c) => (
                <div key={c.id}>
                  {c.name}
                  {c.phone && (
                    <>
                      {' · '}
                      <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a>
                    </>
                  )}
                  {c.email && (
                    <>
                      {' · '}
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </>
                  )}
                </div>
              ))
            : '–'}
        </dd>
        <dt>Tags</dt>
        <dd>{event.tags.length ? event.tags.join(', ') : '–'}</dd>
        <dt>Setlist</dt>
        <dd>
          <Link to="/$band/events/$event/setlist" params={params}>
            {setlist.songs
              ? `${setlist.songs} songs · ${formatDuration(setlist.durationSec)}`
              : band.role === 'member'
                ? 'Build setlist'
                : 'No setlist yet'}
          </Link>
        </dd>
      </dl>
      {event.notes && <p className="notes">{event.notes}</p>}
      {band.role === 'member' && (
        <p>
          {event.archivedAt ? (
            <button type="button" onClick={() => setArchived(false)}>
              Restore
            </button>
          ) : (
            <>
              <Link to="/$band/events/$event/edit" params={params}>
                Edit
              </Link>{' '}
              <button type="button" onClick={() => setArchived(true)}>
                Archive
              </button>
            </>
          )}
        </p>
      )}
      <p>
        <Link to="/$band/events" params={{ band: band.slug }}>
          All events
        </Link>
      </p>
    </>
  )
}
