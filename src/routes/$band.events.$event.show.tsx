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
 * One song per screen. Swiping is native horizontal scroll with snapping; the ‹ › buttons and
 * arrow / page keys (Bluetooth page-turner pedals send those) scroll one screen.
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

  const songs = sets.flatMap((set) => set.songs.map((song, i) => ({ ...song, set: set.name, n: i + 1, of: set.songs.length })))
  // Instant, not smooth: a second press mid-animation would get lost to snapping.
  const step = (by: number) => track.current?.scrollBy({ left: by * track.current.clientWidth })

  return (
    <div className="show">
      <div className="show-bar">
        <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }} aria-label="Close show mode">
          ✕
        </Link>
        <span>{event.title}</span>
        <button type="button" aria-label="Previous song" onClick={() => step(-1)}>
          ‹
        </button>
        <button type="button" aria-label="Next song" onClick={() => step(1)}>
          ›
        </button>
      </div>
      {songs.length === 0 ? (
        <p className="show-empty">No songs in this setlist yet.</p>
      ) : (
        <div className="show-track" ref={track} aria-label="Songs">
          {songs.map((song, i) => {
            const next = songs[i + 1]
            return (
              <article key={i} className="show-song" aria-label={song.title}>
                <p className="show-pos">
                  {song.set} · {song.n}/{song.of}
                </p>
                <h1>{song.title}</h1>
                <p className="show-facts">
                  {[song.key, song.bpm && `${song.bpm} BPM`, song.tuning].filter(Boolean).join(' · ')}
                </p>
                {song.notes && <p className="show-notes">{song.notes}</p>}
                <p className="show-next">
                  {next ? <>Next: {next.set !== song.set && `${next.set} · `}{next.title}</> : 'End of setlist'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
