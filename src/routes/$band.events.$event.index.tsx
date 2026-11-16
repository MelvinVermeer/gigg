import { Link, createFileRoute, getRouteApi, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { formatDate, formatTimes } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { Availability } from '#/components/Availability'
import { Files } from '#/components/Files'
import { Participants } from '#/components/Participants'
import { Markdown } from '#/components/Markdown'
import { ContactLink } from '#/components/PhoneLink'
import { ChevronDown, Pencil } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { askAvailability, bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { useCanEdit } from '#/lib/online'

export const Route = createFileRoute('/$band/events/$event/')({
  loader: async ({ params }) => {
    const res = await bandOp('getEvent', params.band, { slug: params.event })
    if (res.moved) throw redirect({ to: '/$band/events/$event', params: { ...params, event: res.slug } })
    const [availability, bandPeople] = await Promise.all([
      bandOp('getAvailability', params.band, { event: params.event }),
      bandOp('listBandPeople', params.band, {}),
    ])
    return { ...res, availability, bandPeople }
  },
  component: Event,
})

const bandRoute = getRouteApi('/$band')

function Event() {
  const { event, venue, contacts, setlist, standardName, standards, files, availability, bandPeople } = Route.useLoaderData()
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
            {venue && (
              <>
                <dt className="text-muted-foreground">{t.common.venue}</dt>
                <dd>
                  <Link to="/$band/venues/$venue" params={{ band: band.slug, venue: venue.slug }} className="font-medium">
                    {venue.name}
                  </Link>
                  {venue.address && (
                    <>
                      <br />
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`} className="text-muted-foreground">
                        {venue.address}
                      </a>
                    </>
                  )}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t.participants.title}</dt>
            <dd>
              <EventParticipants band={band.slug} event={event.slug} people={bandPeople} availability={availability} canEdit={canEdit && !event.archivedAt} />
            </dd>
            <dt className="text-muted-foreground">{t.events.booking}</dt>
            <dd>
              <Badge variant={event.bookingStatus === 'confirmed' ? 'default' : event.bookingStatus === 'cancelled' ? 'destructive' : 'outline'}>{t.booking[event.bookingStatus]}</Badge>
            </dd>
            <dt className="text-muted-foreground">{t.events.payment}</dt>
            <dd>
              <Badge variant="secondary">{t.payment[event.paymentStatus]}</Badge>
            </dd>
            {event.fee && (
              <>
                <dt className="text-muted-foreground">{t.events.fee}</dt>
                <dd>{event.fee}</dd>
              </>
            )}
            {contacts.length > 0 && (
              <>
                <dt className="text-muted-foreground">{t.common.contacts}</dt>
                <dd className="-my-3">
                  {contacts.map((c) => <ContactLink key={c.id} band={band.slug} contact={c} />)}
                </dd>
              </>
            )}
            {event.tags.length > 0 && (
              <>
                <dt className="text-muted-foreground">{t.common.tags}</dt>
                <dd>{event.tags.join(', ')}</dd>
              </>
            )}
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
      <Availability band={band.slug} event={event.slug} me={availability.people.find((p) => p.mine)} open={availability.open} />
      <Files band={band.slug} owner={{ event: event.slug }} files={files} canEdit={canEdit && !event.archivedAt} />
    </>
  )
}

/** The Participants field on the event page: every change in its dialog is saved right away. */
function EventParticipants({
  band,
  event,
  people,
  availability,
  canEdit,
}: {
  band: string
  event: string
  people: { id: string; name: string; email: string; role: string }[]
  availability: { closed: boolean; people: { userId: string; asked: boolean; stale: boolean; answer: 'yes' | 'maybe' | 'no' | null; note: string | null }[] }
  canEdit: boolean
}) {
  const router = useRouter()
  const saved = availability.people.map((p) => p.userId).join()
  // Ticks show at once; the saved list replaces them when the page data reloads (or the save fails).
  const [chosen, setChosen] = useState(() => new Set(availability.people.map((p) => p.userId)))
  useEffect(() => setChosen(new Set(saved ? saved.split(',') : [])), [saved])
  const states = Object.fromEntries(availability.people.map((p) => [p.userId, { asked: p.asked, answer: p.answer, stale: p.stale, note: p.note }]))
  const reload = () => router.invalidate()
  const ask = async (user?: string) => {
    await askAvailability({ data: { band, event, user } })
  }
  return (
    <Participants
      people={people}
      chosen={chosen}
      states={states}
      closed={availability.closed}
      canEdit={canEdit}
      onChange={async (ids, on) => {
        const next = on ? [...new Set([...chosen, ...ids])] : [...chosen].filter((id) => !ids.includes(id))
        setChosen(new Set(next))
        try {
          await bandOp('setParticipants', band, { event, people: next })
        } finally {
          await router.invalidate()
        }
      }}
      onAskAll={async () => {
        await ask()
        await router.invalidate()
      }}
      onAsk={async (ids) => {
        for (const id of ids) await ask(id)
        await reload()
      }}
      onClose={async () => {
        await bandOp('closeAvailability', band, { event })
        await reload()
      }}
      onReopen={async () => {
        await bandOp('reopenAvailability', band, { event })
        await reload()
      }}
    />
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
