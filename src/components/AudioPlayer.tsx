import { Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { formatDuration } from '#/lib/duration'
import { useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'

export type AudioFile = { id: string; name: string }

export const isAudio = (contentType: string) => contentType.startsWith('audio/')

/** The player that's playing now; starting another one stops it. */
let stopPlaying: (() => void) | undefined

const time = (s: number) => formatDuration(Math.floor(s || 0)) || '0:00'

type Props = {
  files: AudioFile[]
  /** What's played, for the button's label: a song title or a file name. */
  label: string
  /** A next button that steps through `files` (more than one). */
  next?: boolean
}

/**
 * A play button that turns into a mini player. With several files it first asks which one.
 * Renders the button plus (while active) the player with `order-last basis-full col-span-full`,
 * so it drops onto its own line at the end of a flex or grid row.
 */
export function AudioPlayer({ files, label, next = false }: Props) {
  const t = useT()
  const a = t.audio
  const online = useOnline()
  const ref = useRef<HTMLAudioElement>(null)
  const [index, setIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [at, setAt] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  // Download links expire after a few minutes; on an error mid-track we fetch a fresh one once and resume here.
  const resumeAt = useRef(0)
  const retried = useRef(false)
  const dragging = useRef(false)

  const stop = useCallback(() => {
    const el = ref.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    if (stopPlaying === stop) stopPlaying = undefined
    setIndex(null)
    setPlaying(false)
    setAt(0)
    setDuration(0)
  }, [])
  useEffect(() => () => void (stopPlaying === stop && (stopPlaying = undefined)), [stop])

  /** Runs inside the click, so mobile browsers allow the play(). */
  function load(i: number, from = 0) {
    const el = ref.current!
    resumeAt.current = from
    el.src = `/api/files/${files[i].id}${from ? `?r=${Date.now()}` : ''}`
    el.play().catch(() => {})
  }

  function start(i: number) {
    if (stopPlaying !== stop) stopPlaying?.()
    stopPlaying = stop
    retried.current = false
    setError(false)
    setAt(0)
    setDuration(0)
    setIndex(i)
    load(i)
  }

  function failed() {
    if (index === null) return
    if (!retried.current && at > 0) {
      retried.current = true
      return load(index, at)
    }
    setError(true)
    stop()
  }

  if (!files.length) return null
  const many = files.length > 1
  const playButton = (
    <Button variant="ghost" size="icon-sm" aria-label={a.play(label)} disabled={!online} onClick={many ? undefined : () => start(0)}>
      <Play aria-hidden />
    </Button>
  )

  return (
    <>
      <audio
        ref={ref}
        preload="none"
        hidden
        onPlaying={() => {
          setPlaying(true)
          retried.current = false
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => dragging.current || setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          if (resumeAt.current) e.currentTarget.currentTime = resumeAt.current
          resumeAt.current = 0
        }}
        onError={failed}
      />
      {index === null ? (
        <span className="flex items-center">
          {many ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>{playButton}</DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {files.map((f, i) => (
                  <DropdownMenuItem key={f.id} onSelect={() => start(i)}>
                    <Play aria-hidden /> {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            playButton
          )}
          {error && (
            <span role="alert" className="text-xs text-destructive">
              {a.failed}
            </span>
          )}
        </span>
      ) : (
        <span aria-hidden className="size-8" />
      )}
      {index !== null && (
        <div role="group" aria-label={a.player(files[index].name)} className="col-span-full order-last flex basis-full flex-wrap items-center gap-1 pb-1">
          {many && <span className="w-full truncate text-xs text-muted-foreground">{files[index].name}</span>}
          <Button variant="ghost" size="icon-sm" aria-label={playing ? a.pause : a.resume} onClick={() => (playing ? ref.current!.pause() : ref.current!.play())}>
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={a.restart}
            onClick={() => {
              ref.current!.currentTime = 0
              ref.current!.play()
            }}
          >
            <RotateCcw aria-hidden />
          </Button>
          <input
            type="range"
            aria-label={a.position}
            min={0}
            max={duration || 0}
            step="any"
            value={at}
            // While dragging only the slider moves; the audio jumps once on release (no scrubbing sound). Keys jump right away.
            onPointerDown={(e) => {
              dragging.current = true
              const input = e.currentTarget
              const end = (ev: PointerEvent) => {
                removeEventListener('pointerup', end)
                removeEventListener('pointercancel', end)
                dragging.current = false
                if (ev.type === 'pointerup' && ref.current) ref.current.currentTime = Number(input.value)
              }
              addEventListener('pointerup', end)
              addEventListener('pointercancel', end)
            }}
            onChange={(e) => (dragging.current ? setAt(Number(e.target.value)) : (ref.current!.currentTime = Number(e.target.value)))}
            className="h-8 min-w-24 flex-1 accent-primary"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {time(at)} / {time(duration)}
          </span>
          {next && many && (
            <Button variant="ghost" size="icon-sm" aria-label={a.next} onClick={() => start((index + 1) % files.length)}>
              <SkipForward aria-hidden />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label={a.stop} onClick={stop}>
            <Square aria-hidden />
          </Button>
        </div>
      )}
    </>
  )
}
