import { Link, createFileRoute, getRouteApi, redirect } from '@tanstack/react-router'
import { formatWhen, statusLabel } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { Availability, AvailabilitySummary } from '#/components/Availability'
import { Files } from '#/components/Files'
import { Pencil } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/$event/')({
  loader: async ({ params }) => {
    const res = await bandOp('getEvent', params.band, { slug: params.event })
    if (res.moved) throw redirect({ to: '/$band/events/$event', params: { ...params, event: res.slug } })
    return { ...res, availability: await bandOp('getAvailability', params.band, { event: params.event }) }
  },
  component: Event,
})

const bandRoute = getRouteApi('/$band')

function Event() {
  const { event, venue, contacts, setlist, standardName, files, availability } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const params = { band: band.slug, event: event.slug }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/$band/events" params={{ band: band.slug }} className="text-sm text-muted-foreground hover:text-foreground">
            ← All events
          </Link>
          <h1 className="mt-1 mb-0">{event.title}</h1>
        </div>
        {band.role === 'member' && (
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/events/$event/edit" params={params}>
              <Pencil aria-hidden /> Edit
            </Link>
          </Button>
        )}
      </div>
      {event.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          This event is archived.
        </p>
      )}
      <Card>
        <CardContent>
          <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Date</dt>
            <dd>{formatWhen(event)}</dd>
            <AvailabilitySummary band={band.slug} event={event.slug} info={availability} canAsk={band.role === 'member' && !event.archivedAt} />
            <dt className="text-muted-foreground">Venue</dt>
            <dd>
              {venue ? (
                <>
                  {venue.name}
                  {venue.address && (
                    <>
                      <br />
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`} className="text-muted-foreground">
                        {venue.address}
                      </a>
                    </>
                  )}
                </>
              ) : (
                '–'
              )}
            </dd>
            <dt className="text-muted-foreground">Booking</dt>
            <dd>
              <Badge variant={event.bookingStatus === 'confirmed' ? 'default' : 'outline'}>{statusLabel(event.bookingStatus)}</Badge>
            </dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              <Badge variant="secondary">{statusLabel(event.paymentStatus)}</Badge>
            </dd>
            <dt className="text-muted-foreground">Contacts</dt>
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
            <dt className="text-muted-foreground">Tags</dt>
            <dd>{event.tags.length ? event.tags.join(', ') : '–'}</dd>
            <dt className="text-muted-foreground">Setlist</dt>
            <dd>
              <Link to="/$band/events/$event/setlist" params={params} className="font-medium">
                {setlist.songs
                  ? `${standardName ? `${standardName} · ` : ''}${setlist.songs} songs · ${formatDuration(setlist.durationSec)}`
                  : band.role === 'member'
                    ? 'Build setlist'
                    : 'No setlist yet'}
              </Link>
            </dd>
          </dl>
          {event.notes && <p className="notes mt-4 border-t pt-4 text-sm whitespace-pre-wrap">{event.notes}</p>}
        </CardContent>
      </Card>
      <Availability band={band.slug} event={event.slug} info={availability} canAsk={band.role === 'member' && !event.archivedAt} />
      <Files band={band.slug} owner={{ event: event.slug }} files={files} canEdit={band.role === 'member' && !event.archivedAt} />
    </>
  )
}
