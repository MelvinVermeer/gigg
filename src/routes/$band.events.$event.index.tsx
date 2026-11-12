import { Link, createFileRoute, getRouteApi, redirect } from '@tanstack/react-router'
import { formatWhen } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { Availability, AvailabilitySummary } from '#/components/Availability'
import { Files } from '#/components/Files'
import { Pencil } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

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
  const t = useT()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="mb-0">{event.title}</h1>
        {band.role === 'member' && (
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/events/$event/edit" params={params}>
              <Pencil aria-hidden /> {t.common.edit}
            </Link>
          </Button>
        )}
      </div>
      {event.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.events.isArchived}
        </p>
      )}
      <Card>
        <CardContent>
          <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t.common.date}</dt>
            <dd>{formatWhen(event, t.intl)}</dd>
            <AvailabilitySummary band={band.slug} event={event.slug} info={availability} canAsk={band.role === 'member' && !event.archivedAt} />
            <dt className="text-muted-foreground">{t.common.venue}</dt>
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
            <dt className="text-muted-foreground">{t.events.booking}</dt>
            <dd>
              <Badge variant={event.bookingStatus === 'confirmed' ? 'default' : 'outline'}>{t.booking[event.bookingStatus]}</Badge>
            </dd>
            <dt className="text-muted-foreground">{t.events.payment}</dt>
            <dd>
              <Badge variant="secondary">{t.payment[event.paymentStatus]}</Badge>
            </dd>
            <dt className="text-muted-foreground">{t.common.contacts}</dt>
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
            <dt className="text-muted-foreground">{t.common.tags}</dt>
            <dd>{event.tags.length ? event.tags.join(', ') : '–'}</dd>
            <dt className="text-muted-foreground">{t.common.setlist}</dt>
            <dd>
              <Link to="/$band/events/$event/setlist" params={params} className="font-medium">
                {setlist.songs
                  ? `${standardName ? `${standardName} · ` : ''}${t.common.songCount(setlist.songs)} · ${formatDuration(setlist.durationSec)}`
                  : band.role === 'member'
                    ? t.events.buildSetlist
                    : t.events.noSetlist}
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
