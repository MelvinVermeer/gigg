import { useEffect, useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Printer, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { stageFontMm } from '#/lib/stage'
import { useT } from '#/lib/i18n'

type Set = { name: string; songs: { title: string; key: string | null; notes?: string | null }[] }

/** The link back to the setlist, styled by the view; the route supplies where it goes. */
type Back = (props: { className?: string; 'aria-label'?: string; children: ReactNode }) => ReactElement

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
export function ShowMode({ title, sets, back }: { title: string; sets: Set[]; back: Back }) {
  const track = useRef<HTMLDivElement>(null)
  const t = useT()
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
          {back({ 'aria-label': t.setlist.closeShow, children: <X className="size-6" /> })}
        </Button>
        <span className="flex-1 truncate text-muted-foreground">{title}</span>
        {sets.length > 1 && (
          <>
            <Button variant="ghost" size="icon-lg" aria-label={t.setlist.previousSet} onClick={() => step(-1)}>
              <ChevronLeft className="size-7" />
            </Button>
            <Button variant="ghost" size="icon-lg" aria-label={t.setlist.nextSet} onClick={() => step(1)}>
              <ChevronRight className="size-7" />
            </Button>
          </>
        )}
      </div>
      {sets.length === 0 ? (
        <p className="p-6 text-muted-foreground">{t.common.noSetlistYet}</p>
      ) : (
        <div className="show-track flex flex-1 snap-x snap-mandatory overflow-x-auto outline-none" ref={track} aria-label={t.setlist.sets}>
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
              <p className="mt-4 text-lg text-muted-foreground">{sets[i + 1] ? t.setlist.next(sets[i + 1].name) : t.setlist.end}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/** Stage-floor setlist: one page per set, big titles only. Print it or save it as PDF. */
export function StagePrint({ title, sets, back }: { title: string; sets: Set[]; back: Back }) {
  const t = useT()
  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        {back({ className: 'text-sm text-muted-foreground hover:text-foreground', children: t.setlist.back })}
        <Button onClick={() => window.print()}>
          <Printer aria-hidden /> {t.setlist.printPdf}
        </Button>
      </div>
      {sets.map((set, i) => (
        <section key={i} className="stage-page my-4 rounded-xl border bg-card p-4 shadow-sm">
          <header className="text-[4mm] text-muted-foreground">
            <strong className="text-foreground">{set.name}</strong> · {title}
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
