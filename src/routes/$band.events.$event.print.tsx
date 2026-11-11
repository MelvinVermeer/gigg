import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatWhen } from '#/lib/date'
import { stageFontMm } from '#/lib/stage'
import { Printer } from 'lucide-react'
import { Button } from '#/components/ui/button'
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
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Setlist
        </Link>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden /> Print or save as PDF
        </Button>
      </div>
      {sets.map((set, i) => (
        <section key={i} className="stage-page my-4 rounded-xl border bg-card p-4 shadow-sm">
          <header className="text-[4mm] text-muted-foreground">
            <strong className="text-foreground">{set.name}</strong> · {event.title} · {formatWhen(event)}
          </header>
          <ol className="mt-[4mm] list-decimal pl-[1.6em] leading-[1.15] font-bold whitespace-nowrap" style={{ fontSize: `${stageFontMm(set.songs.map((s) => s.title))}mm` }}>
            {set.songs.map((song, j) => (
              <li key={j}>
                {song.title}
                {song.key && <small className="text-[0.45em] font-normal text-muted-foreground"> {song.key}</small>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  )
}
