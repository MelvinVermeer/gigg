import { Link, useRouter } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Combobox } from '#/components/Combobox'
import { formatDuration } from '#/lib/duration'
import { withLabels } from '#/lib/labels'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { applyDrop } from '#/lib/drop'
import { onHandlePointerDown, onRowPointerDown, preventScrollWhileDragging } from '#/lib/song-drag'
import type { OnDrop } from '#/lib/song-drag'
import { cn } from '#/lib/utils'
import { defaultShown, inlineText } from '#/lib/song-fields'

export type SongRef = {
  id: string
  slug: string
  title: string
  key: string | null
  durationSec: number | null
  bpm?: number | null
  tuning?: string | null
  notes?: string | null
  custom?: Record<string, string>
}

type Props = {
  band: string
  /** What the list is, for screen readers: "Set 1", "Encore". */
  label: string
  songs: SongRef[]
  repertoire: SongRef[]
  /** Blocks that can be searched too; picking one adds all its songs. */
  blocks?: { id: string; name: string; songs: SongRef[] }[]
  editable: boolean
  onChange: (songs: SongRef[]) => void
  /** Song fields to show (lib/song-fields.ts); duration stays in its own column. */
  fields?: string[]
  /** Drops handled by a parent with several lists (a setlist's sets). Without it this list is its own drag scope. */
  onDrop?: OnDrop
}

export const totalDuration = (songs: SongRef[]) => songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)

/**
 * An ordered list of songs: drag to reorder or out to remove (long-press on touch, grip handle with a mouse), remove, add from the repertoire.
 * Up/down buttons stay for the keyboard, visible on focus. Used for sets and blocks.
 */
export function SongListEditor({ band, label, songs, repertoire, blocks = [], editable, onChange, onDrop, fields = defaultShown.page }: Props) {
  const router = useRouter()
  const t = useT()
  const [text, setText] = useState('')
  const numbered = fields.includes('number')
  const options = useMemo(() => withLabels(repertoire, (s) => s.title, (s) => s.key), [repertoire])

  const blockLabel = (b: { name: string; songs: SongRef[] }) => t.songList.block(b.name, b.songs.length)
  const query = text.trim()
  const q = query.toLowerCase()
  const matches = (label: string) => label.toLowerCase().includes(q)
  const exact = options.some((o) => o.label.toLowerCase() === q)

  function add(picked: SongRef[]) {
    onChange([...songs, ...picked])
    setText('')
  }

  /** Not in the repertoire: create it with that title. */
  async function addNew() {
    const song = (await bandOp('createSong', band, { title: query })) as SongRef
    await router.invalidate()
    add([song])
  }

  const drop: OnDrop = onDrop ?? ((from, to) => onChange(applyDrop([songs], from, to)[0]))
  // Non-passive, so a drag can stop the page from scrolling (React's touch listeners are passive).
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current!
    el.addEventListener('touchmove', preventScrollWhileDragging, { passive: false })
    return () => el.removeEventListener('touchmove', preventScrollWhileDragging)
  }, [])

  const move = (i: number, by: number) => {
    const next = [...songs]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }

  return (
    <div ref={root} className="grid gap-3" {...(editable && !onDrop && { 'data-drag-scope': '', 'data-drop-zone': '' })}>
      {songs.length ? (
        <ol className={cn('song-list divide-y', editable && 'editable')}>
          {songs.map((s, i) => (
            <li
              key={`${s.id}-${i}`}
              className={cn(
                'grid items-center gap-1 py-1.5 text-sm',
                numbered ? 'grid-cols-[1.75rem_1fr_3.25rem_auto]' : 'grid-cols-[1fr_3.25rem_auto]',
                editable && (numbered ? 'pointer-fine:grid-cols-[1.25rem_1.75rem_1fr_3.25rem_auto]' : 'pointer-fine:grid-cols-[1.25rem_1fr_3.25rem_auto]'),
              )}
              {...(editable && { 'data-drag-row': '', onPointerDown: (e) => onRowPointerDown(e, drop) })}
            >
              {editable && (
                <span
                  aria-hidden
                  className="drag-handle hidden cursor-grab text-muted-foreground pointer-fine:flex"
                  onPointerDown={(e) => onHandlePointerDown(e, drop)}
                >
                  <GripVertical className="size-4" />
                </span>
              )}
              {numbered && <span className="text-muted-foreground tabular-nums">{i + 1}.</span>}
              <span className="title font-medium [overflow-wrap:anywhere]">
                <Link to="/$band/songs/$song" params={{ band, song: s.slug }} className="underline-offset-4 hover:underline">
                  {s.title}
                </Link>
                {inlineText(s, fields, ['durationSec']) && <span className="text-xs font-normal text-muted-foreground"> {inlineText(s, fields, ['durationSec'])}</span>}
                {fields.includes('notes') && s.notes && <span className="block text-xs font-normal whitespace-pre-wrap text-muted-foreground">{s.notes}</span>}
              </span>
              <span className="text-muted-foreground tabular-nums">{fields.includes('durationSec') && formatDuration(s.durationSec)}</span>
              {editable ? (
                <span className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="sr-only focus-visible:not-sr-only"
                    aria-label={t.songList.moveUp(s.title)}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="sr-only focus-visible:not-sr-only"
                    aria-label={t.songList.moveDown(s.title)}
                    disabled={i === songs.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t.songList.remove(s.title)} onClick={() => onChange(songs.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </span>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p data-drop-empty className="text-sm text-muted-foreground">
          {t.common.noSongsYet}
        </p>
      )}
      {editable && (
        <Combobox
          label={t.songList.addTo(label)}
          value={text}
          onValueChange={setText}
          placeholder={blocks.length ? t.songList.searchSongOrBlock : t.songList.searchSong}
          options={[
            ...blocks.filter((b) => matches(blockLabel(b))).map((b) => ({ value: `b${b.id}`, label: blockLabel(b), onSelect: () => add(b.songs) })),
            ...options.filter((o) => matches(o.label)).map((o) => ({ value: o.id, label: o.label, onSelect: () => add([o]) })),
            ...(exact ? [] : [{ value: '+', label: <><Plus aria-hidden /> {t.songList.addNew(query)}</>, onSelect: addNew }]),
          ]}
        />
      )}
    </div>
  )
}
