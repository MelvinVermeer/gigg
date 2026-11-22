import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Markdown } from '#/components/Markdown'
import { Button } from '#/components/ui/button'
import { small, stageFontMm } from '#/lib/stage'
import { useT } from '#/lib/i18n'
import { inlineText, useShownFields } from '#/lib/song-fields'
import type { SongValues } from '#/lib/song-fields'

type Set = { name: string; songs: (SongValues & { lyrics?: string | null })[] }

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
export function ShowMode({ title, sets, back, lyrics = false }: { title: string; sets: Set[]; back: Back; lyrics?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const t = useT()
  const { cols } = useShownFields('show')
  const notes = cols.includes('notes')
  // Lyrics mode: one song per screen, straight across sets.
  const songs = sets.flatMap((set) => set.songs.map((song, j) => ({ set, song, j })))
  const pages = lyrics ? songs.length : sets.length
  const [page, setPage] = useState(0)
  const cur = lyrics ? songs[page] : undefined
  const position = lyrics
    ? cur && `${cur.set.name} · ${cur.j + 1}/${cur.set.songs.length}`
    : sets[page] && `${sets[page].name} · ${page + 1}/${sets.length}`
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
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{title}</span>
        {position && <span className="shrink-0 font-semibold whitespace-nowrap">{position}</span>}
        {pages > 1 && (
          <>
            <Button variant="ghost" size="icon-lg" aria-label={lyrics ? t.setlist.previousSong : t.setlist.previousSet} onClick={() => step(-1)}>
              <ChevronLeft className="size-7" />
            </Button>
            <Button variant="ghost" size="icon-lg" aria-label={lyrics ? t.setlist.nextSong : t.setlist.nextSet} onClick={() => step(1)}>
              <ChevronRight className="size-7" />
            </Button>
          </>
        )}
      </div>
      {pages === 0 ? (
        <p className="p-6 text-muted-foreground">{t.common.noSetlistYet}</p>
      ) : (
        <div className="show-track flex flex-1 snap-x snap-mandatory overflow-x-auto outline-none" ref={track}
          onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          aria-label={lyrics ? t.setlist.songs : t.setlist.sets}>
          {lyrics
            ? songs.map(({ song }, i) => (
                <article key={i} className="show-set flex-[0_0_100%] snap-start snap-always overflow-y-auto px-5 pt-4 pb-6" aria-label={song.title}>
                  <h2 className="mt-0 mb-0 text-3xl font-bold">{song.title}</h2>
                  {inlineText(song, cols) && <p className="text-muted-foreground">{inlineText(song, cols)}</p>}
                  {song.lyrics && <Markdown className="lyrics mt-4 text-2xl leading-snug">{song.lyrics}</Markdown>}
                  <p className="mt-6 text-lg text-muted-foreground">{songs[i + 1] ? t.setlist.next(songs[i + 1].song.title) : t.setlist.end}</p>
                </article>
              ))
            : sets.map((set, i) => (
            <article
              key={i}
              className="show-set flex-[0_0_100%] snap-start snap-always overflow-y-auto px-5 pt-4 pb-6"
              aria-label={set.name}
              style={{ '--n': Math.max(set.songs.length, 6) } as React.CSSProperties}
            >
              <ol className={`m-0 leading-[1.15] font-bold marker:text-muted-foreground ${cols.includes('number') ? 'list-decimal pl-[1.4em]' : 'list-none pl-0'}`}>
                {set.songs.map((song, j) => (
                  <li key={j}>
                    {song.title}
                    {inlineText(song, cols) && <small className="text-[0.5em] font-normal text-muted-foreground"> {inlineText(song, cols)}</small>}
                    {notes && song.notes && <span className="block text-[max(0.4em,0.9rem)] font-normal whitespace-pre-wrap text-muted-foreground">{song.notes}</span>}
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

/** Stage-floor setlist: one page per set, big titles only. Hidden on screen; window.print() prints only this (styles.css). */
export function StagePrint({ title, sets }: { title: string; sets: Set[] }) {
  const { cols } = useShownFields('print')
  const notes = cols.includes('notes')
  // Portal to <body> so the print stylesheet can hide everything else; after mount, since there's no document on the server.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div className="print-sheet">
      {sets.map((set, i) => (
        <section key={i} className="stage-page">
          <header className="text-[4mm] text-muted-foreground">
            <strong className="text-foreground">{set.name}</strong> · {title}
          </header>
          <ol
            className={`mt-[4mm] leading-[1.15] font-bold whitespace-nowrap ${cols.includes('number') ? 'list-decimal pl-[1.6em]' : 'list-none pl-0'}`}
            style={{ fontSize: `${stageFontMm(set.songs.map((s) => ({ title: s.title, extra: inlineText(s, cols), notes: notes ? (s.notes ?? '') : '' })))}mm` }}
          >
            {set.songs.map((song, j) => (
              <li key={j}>
                {song.title}
                {inlineText(song, cols) && (
                  <small className="font-normal text-muted-foreground" style={{ fontSize: `${small}em` }}>
                    {' '}
                    {inlineText(song, cols)}
                  </small>
                )}
                {notes && song.notes && (
                  <span className="block font-normal whitespace-pre-wrap text-muted-foreground" style={{ fontSize: `${small}em` }}>
                    {song.notes}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>,
    document.body,
  )
}
