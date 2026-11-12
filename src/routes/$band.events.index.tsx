import { Link, createFileRoute, getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { formatDate, formatTimes } from '#/lib/date'
import { ListFilter, Plus } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

const statuses = ['lead', 'option', 'confirmed', 'cancelled'] as const
type Status = (typeof statuses)[number]
const defaultStatuses: Status[] = ['option', 'confirmed']

/** The URL carries only what differs from the default view: upcoming, option + confirmed, mine. */
type Search = { when?: 'past' | 'archived'; status?: string; who?: 'all' }

const parseStatuses = (s: string | undefined): Status[] =>
  s === undefined ? defaultStatuses : statuses.filter((x) => s.split(',').includes(x))

export const Route = createFileRoute('/$band/events/')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search.when === 'past' || search.when === 'archived' ? { when: search.when } : {}),
    ...(typeof search.status === 'string' ? { status: search.status } : {}),
    ...(search.who === 'all' ? { who: 'all' as const } : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    bandOp(
      'listEvents',
      params.band,
      deps.when === 'archived'
        ? { when: 'archived' }
        : { when: deps.when ?? 'upcoming', statuses: parseStatuses(deps.status), mine: deps.who !== 'all' },
    ),
  component: Events,
})

const bandRoute = getRouteApi('/$band')

function Events() {
  const events = Route.useLoaderData()
  const search = Route.useSearch()
  const when = search.when ?? 'upcoming'
  const filtered = search.when === 'past' || search.status !== undefined || search.who === 'all'
  const band = bandRoute.useLoaderData()
  const params = { band: band.slug }
  const router = useRouter()
  const t = useT()

  // Fetch the next few gigs and their setlists now, so the service worker has them for offline use.
  useEffect(() => {
    if (when !== 'upcoming') return
    for (const e of events.slice(0, 3)) {
      const p = { band: band.slug, event: e.slug }
      router.preloadRoute({ to: '/$band/events/$event', params: p }).catch(() => {})
      router.preloadRoute({ to: '/$band/events/$event/show', params: p }).catch(() => {})
    }
  }, [events, when, band.slug, router])

  const empty = when === 'archived' ? t.events.noArchived : filtered ? t.events.noMatch : t.events.noUpcoming

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{when === 'archived' ? t.events.archivedList : t.events.title}</h1>
        <div className="flex gap-2">
          {when === 'archived' ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/events" params={params}>
                {t.events.back}
              </Link>
            </Button>
          ) : (
            <Filter search={search} />
          )}
          {band.role === 'member' && when !== 'archived' && (
            <Button asChild size="sm">
              <Link to="/$band/events/new" params={params}>
                <Plus aria-hidden /> <span className="max-sm:sr-only">{t.events.add}</span>
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
                {formatDate(e.date, t.intl)}
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
                <Badge variant={e.bookingStatus === 'confirmed' ? 'default' : 'outline'}>{t.booking[e.bookingStatus]}</Badge>
                {e.paymentStatus !== 'open' && <Badge variant="secondary">{t.payment[e.paymentStatus]}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <p className="mb-0">{empty}</p>
          {when !== 'archived' && filtered && (
            <Link to="/$band/events" params={params} className="mt-2 inline-block underline">
              {t.events.resetFilter}
            </Link>
          )}
        </div>
      )}
    </>
  )
}

/** One menu for time, statuses and whose events; every change goes straight into the URL. */
function Filter({ search }: { search: Search }) {
  const t = useT()
  const navigate = useNavigate({ from: Route.fullPath })
  const set = (patch: Partial<Search>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true })
  const chosen = parseStatuses(search.status)
  const toggle = (s: Status, on: boolean) => {
    const next = statuses.filter((x) => (x === s ? on : chosen.includes(x)))
    const isDefault = next.join() === defaultStatuses.join()
    set({ status: isDefault ? undefined : next.join(',') })
  }
  const changed = [search.when === 'past', search.status !== undefined, search.who === 'all'].filter(Boolean).length
  const keepOpen = (e: Event) => e.preventDefault()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={changed ? `${t.events.filter} (${changed})` : t.events.filter}>
          <ListFilter aria-hidden /> <span className="max-sm:sr-only">{t.events.filter}</span>
          {changed > 0 && <Badge className="h-5 min-w-5 px-1 tabular-nums">{changed}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup value={search.when ?? 'upcoming'} onValueChange={(v) => set({ when: v === 'past' ? 'past' : undefined })}>
          <DropdownMenuRadioItem value="upcoming" onSelect={keepOpen}>{t.events.upcoming}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="past" onSelect={keepOpen}>{t.events.past}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {statuses.map((s) => (
          <DropdownMenuCheckboxItem key={s} checked={chosen.includes(s)} onCheckedChange={(on) => toggle(s, on)} onSelect={keepOpen}>
            {t.booking[s]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={search.who ?? 'mine'} onValueChange={(v) => set({ who: v === 'all' ? 'all' : undefined })}>
          <DropdownMenuRadioItem value="mine" onSelect={keepOpen}>{t.events.mine}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="all" onSelect={keepOpen}>{t.events.everyone}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {changed > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => set({ when: undefined, status: undefined, who: undefined })}>{t.events.resetFilter}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
