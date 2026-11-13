import { Link, createFileRoute, getRouteApi, redirect, useRouter } from '@tanstack/react-router'
import { formatDate, formatTimes } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { Availability, AvailabilitySummary } from '#/components/Availability'
import { Files } from '#/components/Files'
import { Markdown } from '#/components/Markdown'
import { PhoneLink } from '#/components/PhoneLink'
import { ChevronDown, Pencil } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { useCanEdit } from '#/lib/online'

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
  const { event, venue, contacts, setlist, standardName, standards, files, availability } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const params = { band: band.slug, event: event.slug }
  const canEdit = useCanEdit()
  const t = useT()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="mb-0">{event.title}</h1>
        {canEdit && (
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
            <dd>
              {/* Breaks only between date and time, never inside either. */}
              <span className="whitespace-nowrap">{formatDate(event.date, t.intl)}</span>
              {event.startTime && <> <span className="whitespace-nowrap">· {formatTimes(event.startTime, event.endTime)}</span></>}
            </dd>
            <AvailabilitySummary band={band.slug} event={event.slug} info={availability} canAsk={canEdit && !event.archivedAt} />
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
                          <PhoneLink name={c.name} phone={c.phone} />
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
              {setlist.songs || standardName || !canEdit ? (
                <Link to="/$band/events/$event/setlist" params={params} className="font-medium">
                  {setlist.songs || standardName
                    ? `${standardName ? `${standardName} · ` : ''}${t.common.songCount(setlist.songs)} · ${formatDuration(setlist.durationSec)}`
                    : t.events.noSetlist}
                </Link>
              ) : (
                <ChooseSetlist event={event.slug} standards={standards} />
              )}
            </dd>
          </dl>
          {event.notes && <Markdown className="notes mt-4 border-t pt-4 text-sm">{event.notes}</Markdown>}
        </CardContent>
      </Card>
      <Availability band={band.slug} event={event.slug} info={availability} canAsk={canEdit && !event.archivedAt} />
      <Files band={band.slug} owner={{ event: event.slug }} files={files} canEdit={canEdit && !event.archivedAt} />
    </>
  )
}

/** No setlist yet: start a new one, or use a standalone setlist (template) as is. */
function ChooseSetlist({ event, standards }: { event: string; standards: { id: string; name: string }[] }) {
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const t = useT()
  const params = { band: band.slug, event }
  const newLink = (
    <Link to="/$band/events/$event/setlist" params={params} className="font-medium">
      {t.events.chooseSetlist}
    </Link>
  )
  if (!standards.length) return newLink

  async function use(setlist: string) {
    await bandOp('useStandardSetlist', band.slug, { event, setlist })
    await router.invalidate()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 font-medium">
        {t.events.chooseSetlist} <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <Link to="/$band/events/$event/setlist" params={params}>
            {t.events.newSetlist}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {standards.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => use(s.id)}>
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
