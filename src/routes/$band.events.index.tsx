import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { formatDate, formatTimes, statusLabel } from '#/lib/date'
import { Plus } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
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
  const router = useRouter()

  // Fetch the next few gigs and their setlists now, so the service worker has them for offline use.
  useEffect(() => {
    if (when !== 'upcoming') return
    for (const e of events.slice(0, 3)) {
      const p = { band: band.slug, event: e.slug }
      router.preloadRoute({ to: '/$band/events/$event', params: p }).catch(() => {})
      router.preloadRoute({ to: '/$band/events/$event/show', params: p }).catch(() => {})
    }
  }, [events, when, band.slug, router])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{headings[when]}</h1>
        <div className="flex gap-2">
          {when === 'upcoming' ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/events" params={params} search={{ when: 'past' }}>
                Past events
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/events" params={params}>
                Upcoming events
              </Link>
            </Button>
          )}
          {band.role === 'member' && (
            <Button asChild size="sm">
              <Link to="/$band/events/new" params={params}>
                <Plus aria-hidden /> Add event
              </Link>
            </Button>
          )}
        </div>
      </div>
      {events.length ? (
        <ul className="events divide-y rounded-xl border bg-card">
          {events.map((e) => (
            <li key={e.slug} className="relative flex items-center gap-4 px-4 py-3 hover:bg-muted/50">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <span className="date shrink-0 text-sm text-muted-foreground tabular-nums sm:w-32">
                {formatDate(e.date)}
                {e.startTime && <span className="block text-xs">{formatTimes(e.startTime, e.endTime)}</span>}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <Link to="/$band/events/$event" params={{ ...params, event: e.slug }} className="truncate font-medium after:absolute after:inset-0">
                  {e.title}
                </Link>
                {e.venue && <span className="venue truncate text-sm text-muted-foreground">{e.venue}</span>}
              </span>
              </span>
              <span className="status flex shrink-0 gap-1">
                <Badge variant={e.bookingStatus === 'confirmed' ? 'default' : 'outline'}>{statusLabel(e.bookingStatus)}</Badge>
                {e.paymentStatus !== 'open' && <Badge variant="secondary">{statusLabel(e.paymentStatus)}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {when === 'upcoming' ? 'No upcoming events.' : `No ${when} events.`}
        </p>
      )}
    </>
  )
}
