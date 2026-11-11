import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/$event/show')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Show,
})

const bandRoute = getRouteApi('/$band')

/** Keep the screen on while show mode is open (re-requested after the tab was hidden). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    const request = () => {
      if (document.visibilityState === 'visible')
        navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      document.removeEventListener('visibilitychange', request)
      lock?.release()
    }
  }, [])
}

const keys: Record<string, number> = { ArrowRight: 1, PageDown: 1, ' ': 1, ArrowLeft: -1, PageUp: -1 }

/**
 * One set per screen, songs in big type sized to fit. Swiping is native horizontal scroll with
 * snapping; the ‹ › buttons and arrow / page keys (Bluetooth page-turner pedals) go to the next set.
 */
function Show() {
  const { event, sets } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const track = useRef<HTMLDivElement>(null)
  useWakeLock()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Space on a focused button already presses it.
      if (!(e.key in keys) || (e.key === ' ' && e.target instanceof HTMLButtonElement)) return
      e.preventDefault()
      step(keys[e.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Instant, not smooth: a second press mid-animation would get lost to snapping.
  const step = (by: number) => track.current?.scrollBy({ left: by * track.current.clientWidth })

  return (
    <div className="show fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="show-bar flex items-center gap-2 border-b px-2 py-1.5">
        <Button asChild variant="ghost" size="icon-lg">
          <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }} aria-label="Close show mode">
            <X className="size-6" />
          </Link>
        </Button>
        <span className="flex-1 truncate text-muted-foreground">{event.title}</span>
        {sets.length > 1 && (
          <>
            <Button variant="ghost" size="icon-lg" aria-label="Previous set" onClick={() => step(-1)}>
              <ChevronLeft className="size-7" />
            </Button>
            <Button variant="ghost" size="icon-lg" aria-label="Next set" onClick={() => step(1)}>
              <ChevronRight className="size-7" />
            </Button>
          </>
        )}
      </div>
      {sets.length === 0 ? (
        <p className="p-6 text-muted-foreground">No setlist yet.</p>
      ) : (
        <div className="show-track flex flex-1 snap-x snap-mandatory overflow-x-auto outline-none" ref={track} aria-label="Sets">
          {sets.map((set, i) => (
            <article
              key={i}
              className="show-set flex-[0_0_100%] snap-start snap-always overflow-y-auto px-5 pt-4 pb-6"
              aria-label={set.name}
              style={{ '--n': Math.max(set.songs.length, 6) } as React.CSSProperties}
            >
              <h2 className="mb-2 text-xl">
                {set.name}{' '}
                <small className="font-normal text-muted-foreground">
                  {i + 1}/{sets.length}
                </small>
              </h2>
              <ol className="m-0 list-decimal pl-[1.4em] leading-[1.15] font-bold marker:text-muted-foreground">
                {set.songs.map((song, j) => (
                  <li key={j}>
                    {song.title}
                    {song.key && <small className="text-[0.5em] font-normal text-muted-foreground"> {song.key}</small>}
                    {song.notes && <span className="block text-[max(0.4em,0.9rem)] font-normal whitespace-pre-wrap text-muted-foreground">{song.notes}</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-lg text-muted-foreground">{sets[i + 1] ? `Next: ${sets[i + 1].name} ›` : 'End of setlist'}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
