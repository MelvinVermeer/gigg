import { Link, useRouter } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { formatDuration } from '#/lib/duration'
import { withLabels } from '#/lib/labels'
import { bandOp } from '#/server/fns'

export type SongRef = { id: string; slug: string; title: string; key: string | null; durationSec: number | null }

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
}

export const totalDuration = (songs: SongRef[]) => songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)

/** An ordered list of songs: move up/down, remove, add from the repertoire. Used for sets and blocks. */
export function SongListEditor({ band, label, songs, repertoire, blocks = [], editable, onChange }: Props) {
  const listId = useId()
  const router = useRouter()
  const [text, setText] = useState('')
  const options = useMemo(() => withLabels(repertoire, (s) => s.title, (s) => s.key), [repertoire])

  const blockLabel = (b: { name: string; songs: SongRef[] }) => `Block: ${b.name} (${b.songs.length})`

  const pickedBlock = blocks.find((b) => blockLabel(b) === text.trim())

  async function add() {
    const title = text.trim()
    if (!title) return
    const block = pickedBlock
    if (block) {
      onChange([...songs, ...block.songs])
      setText('')
      return
    }
    let song: SongRef | undefined = options.find((o) => o.label === title)
    // Not in the repertoire: create it with that title.
    if (!song) {
      song = (await bandOp('createSong', band, { title })) as SongRef
      await router.invalidate()
    }
    onChange([...songs, song])
    setText('')
  }

  const move = (i: number, by: number) => {
    const next = [...songs]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }

  return (
    <div className="grid gap-3">
      {songs.length ? (
        <ol className="song-list divide-y">
          {songs.map((s, i) => (
            <li key={`${s.id}-${i}`} className="grid grid-cols-[1.75rem_1fr_2.5rem_3.25rem_auto] items-center gap-1 py-1.5 text-sm">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="title font-medium [overflow-wrap:anywhere]">
                <Link to="/$band/songs/$song" params={{ band, song: s.slug }} className="underline-offset-4 hover:underline">
                  {s.title}
                </Link>
              </span>
              <span className="text-muted-foreground">{s.key}</span>
              <span className="text-muted-foreground tabular-nums">{formatDuration(s.durationSec)}</span>
              {editable ? (
                <span className="flex gap-0.5">
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${s.title} down`}
                    disabled={i === songs.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.title}`} onClick={() => onChange(songs.filter((_, j) => j !== i))}>
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
        <p className="text-sm text-muted-foreground">No songs yet.</p>
      )}
      {editable && (
        <span className="add-song flex gap-2">
          <Input
            aria-label={`Add song to ${label}`}
            list={listId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder={blocks.length ? 'Search a song or block' : 'Search a song'}
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={add}>
            <Plus aria-hidden /> {pickedBlock ? 'Add block' : 'Add song'}
          </Button>
          <datalist id={listId}>
            {blocks.map((b) => (
              <option key={b.id} value={blockLabel(b)} />
            ))}
            {options.map((o) => (
              <option key={o.id} value={o.label} />
            ))}
          </datalist>
        </span>
      )}
    </div>
  )
}
