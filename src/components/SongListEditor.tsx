import { Link, useRouter } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Command, CommandInput, CommandItem, CommandList } from '#/components/ui/command'
import { formatDuration } from '#/lib/duration'
import { withLabels } from '#/lib/labels'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

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
  const router = useRouter()
  const t = useT()
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
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
                  <Button variant="ghost" size="icon-sm" aria-label={t.songList.moveUp(s.title)} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
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
        <p className="text-sm text-muted-foreground">{t.common.noSongsYet}</p>
      )}
      {editable && (
        // Typing opens the matches below; tapping one or pressing Enter adds the highlighted one.
        <Command label={t.songList.addTo(label)} shouldFilter={false} className="add-song relative overflow-visible bg-transparent">
          <CommandInput
            value={text}
            onValueChange={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Escape' && setText('')}
            placeholder={blocks.length ? t.songList.searchSongOrBlock : t.songList.searchSong}
            className="h-9 rounded-md border border-input px-3 text-base shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          />
          {focused && query && (
            <CommandList
              // Keep focus (and the phone keyboard) on the input while picking.
              onMouseDown={(e) => e.preventDefault()}
              className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md"
            >
              {blocks.filter((b) => matches(blockLabel(b))).map((b) => (
                <CommandItem key={b.id} value={blockLabel(b)} onSelect={() => add(b.songs)}>
                  {blockLabel(b)}
                </CommandItem>
              ))}
              {options.filter((o) => matches(o.label)).map((o) => (
                <CommandItem key={o.id} value={o.label} onSelect={() => add([o])}>
                  {o.label}
                </CommandItem>
              ))}
              {!exact && (
                <CommandItem value="+" onSelect={addNew}>
                  <Plus aria-hidden /> {t.songList.addNew(query)}
                </CommandItem>
              )}
            </CommandList>
          )}
        </Command>
      )}
    </div>
  )
}
