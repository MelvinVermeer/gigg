import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
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
    <div className="show">
      <div className="show-bar">
        <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }} aria-label="Close show mode">
          ✕
        </Link>
        <span>{event.title}</span>
        {sets.length > 1 && (
          <>
            <button type="button" aria-label="Previous set" onClick={() => step(-1)}>
              ‹
            </button>
            <button type="button" aria-label="Next set" onClick={() => step(1)}>
              ›
            </button>
          </>
        )}
      </div>
      {sets.length === 0 ? (
        <p className="show-empty">No setlist yet.</p>
      ) : (
        <div className="show-track" ref={track} aria-label="Sets">
          {sets.map((set, i) => (
            <article key={i} className="show-set" aria-label={set.name} style={{ '--n': Math.max(set.songs.length, 6) } as React.CSSProperties}>
              <h1>
                {set.name} <small>{i + 1}/{sets.length}</small>
              </h1>
              <ol>
                {set.songs.map((song, j) => (
                  <li key={j}>
                    {song.title}
                    {song.key && <small> {song.key}</small>}
                    {song.notes && <span className="show-note">{song.notes}</span>}
                  </li>
                ))}
              </ol>
              <p className="show-next">{sets[i + 1] ? `Next: ${sets[i + 1].name} ›` : 'End of setlist'}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
