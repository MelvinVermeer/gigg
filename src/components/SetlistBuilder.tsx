import { Link, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { cn } from '#/lib/utils'
import { SongListEditor, totalDuration } from '#/components/SongListEditor'
import type { SongRef } from '#/components/SongListEditor'
import { formatDate } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'

type Set = { name: string; songs: SongRef[] }

export type CopySource = { id: string; name: string; date: string | null }

/** What to copy from, as shown in the picker: standalone setlists by name, events with their date. */
export const copyLabel = (s: CopySource) => (s.date ? `${formatDate(s.date)} · ${s.name}` : s.name)

type Props = {
  band: string
  /** An event's setlist (by event slug) or a standalone one (by id). */
  target: { event: string } | { setlist: string }
  data: {
    sets: Set[]
    songs: SongRef[]
    blocks: { id: string; name: string; songs: SongRef[] }[]
    copyFrom: CopySource[]
  }
  editable: boolean
}

/** Sets with songs and blocks. Every change saves the whole setlist right away. */
export function SetlistBuilder({ band, target, data, editable }: Props) {
  const router = useRouter()
  const [sets, setSets] = useState<Set[]>(data.sets)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error' | ''>('')
  const [copyFrom, setCopyFrom] = useState(data.copyFrom[0]?.id ?? '')
  const queue = useRef(Promise.resolve())

  // Fresh data from the server (after a copy) replaces local state.
  useEffect(() => setSets(data.sets), [data.sets])

  /** Saves run one after another, in order. */
  function persist(next: Set[]) {
    setSets(next)
    setStatus('saving')
    const body = next.map((s) => ({ name: s.name.trim() || 'Set', songIds: s.songs.map((song) => song.id) }))
    queue.current = queue.current
      .then(() => bandOp('saveSetlist', band, { ...target, sets: body }))
      .then(
        () => setStatus('saved'),
        () => setStatus('error'),
      )
  }

  const updateSet = (i: number, patch: Partial<Set>) => sets.map((s, j) => (j === i ? { ...s, ...patch } : s))

  async function copy() {
    setStatus('saving')
    await bandOp('copySetlist', band, { ...target, from: copyFrom })
    await router.invalidate()
    setStatus('saved')
  }

  const total = totalDuration(sets.flatMap((s) => s.songs))

  return (
    <div className="grid gap-4">
      <p className="setlist-meta flex items-center gap-3 text-sm text-muted-foreground">
        {sets.flatMap((s) => s.songs).length} songs · {formatDuration(total) || '0:00'}
        {status && (
          <Badge role="status" variant={status === 'error' ? 'destructive' : 'secondary'} className={cn('save-status', status)}>
            {{ saving: 'Saving…', saved: 'Saved', error: 'Not saved, try again' }[status]}
          </Badge>
        )}
      </p>

      {sets.length === 0 &&
        (editable ? (
          <div className="grid gap-3 rounded-xl border border-dashed p-6">
            <div>
              <Button onClick={() => persist([{ name: 'Set 1', songs: [] }])}>Start an empty setlist</Button>
            </div>
            {data.copyFrom.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <NativeSelect aria-label="Copy setlist from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="min-w-0 flex-1">
                  {data.copyFrom.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {copyLabel(s)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button variant="outline" onClick={copy}>
                  Copy that setlist
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No setlist yet.</p>
        ))}

      {sets.map((set, i) => (
        <section key={i} className="set rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-3">
            {editable ? (
              <Input
                aria-label={`Name of set ${i + 1}`}
                className="h-8 max-w-[70%] text-base font-semibold md:text-base"
                value={set.name}
                maxLength={60}
                onChange={(e) => setSets(updateSet(i, { name: e.target.value }))}
                onBlur={() => persist(sets)}
              />
            ) : (
              set.name
            )}
            <small className="text-sm font-normal text-muted-foreground tabular-nums">{formatDuration(totalDuration(set.songs)) || '0:00'}</small>
          </h2>
          <SongListEditor
            band={band}
            label={set.name}
            songs={set.songs}
            repertoire={data.songs}
            blocks={data.blocks}
            editable={editable}
            // Removing the last song removes the set.
            onChange={(songs) => persist(songs.length || !set.songs.length ? updateSet(i, { songs }) : sets.filter((_, j) => j !== i))}
          />
        </section>
      ))}

      {editable && sets.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => persist([...sets, { name: `Set ${sets.length + 1}`, songs: [] }])}>
            <Plus aria-hidden /> Add set
          </Button>
          <Button asChild variant="ghost">
            <Link to="/$band/setlists" params={{ band }} hash="blocks">
              Manage blocks
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
