import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { SongListEditor, totalDuration } from '#/components/SongListEditor'
import type { SongRef } from '#/components/SongListEditor'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { applyDrop } from '#/lib/drop'
import type { OnDrop } from '#/lib/song-drag'

type Set = { name: string; songs: SongRef[] }

type Props = {
  band: string
  /** An event's setlist (by event slug) or a standalone one (by id). */
  target: { event: string } | { setlist: string }
  data: {
    sets: Set[]
    songs: SongRef[]
    blocks: { id: string; name: string; songs: SongRef[] }[]
  }
  editable: boolean
}

/**
 * Sets with songs and blocks. Every change saves the whole setlist right away.
 * Local state wins over refetched data (a refetch can land before a save); remount with a new `key` to start over from the server.
 */
export function SetlistBuilder({ band, target, data, editable }: Props) {
  const t = useT()
  const [sets, setSets] = useState<Set[]>(data.sets)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error' | ''>('')
  const queue = useRef(Promise.resolve())

  /** Saves run one after another, in order. */
  function persist(next: Set[]) {
    setSets(next)
    setStatus('saving')
    const body = next.map((s) => ({ name: s.name.trim() || t.setlist.set, songIds: s.songs.map((song) => song.id) }))
    queue.current = queue.current
      .then(() => bandOp('saveSetlist', band, { ...target, sets: body }))
      .then(
        () => setStatus('saved'),
        () => setStatus('error'),
      )
  }

  // An empty setlist being edited starts with one empty set, saved once something is added.
  const shown: Set[] = editable && sets.length === 0 ? [{ name: t.setlist.setN(1), songs: [] }] : sets
  const updateSet = (i: number, patch: Partial<Set>) => shown.map((s, j) => (j === i ? { ...s, ...patch } : s))

  /** A drag moved or removed a song; sets it emptied disappear, like removing their last song. */
  const drop: OnDrop = (from, to) => {
    const lists = shown.map((s) => s.songs)
    const next = applyDrop(lists, from, to)
    if (next === lists) return
    persist(shown.map((s, i) => ({ ...s, songs: next[i] })).filter((s, i) => s.songs.length || !shown[i].songs.length))
  }

  const total = totalDuration(sets.flatMap((s) => s.songs))

  return (
    <div className="grid gap-4" {...(editable && { 'data-drag-scope': '' })}>
      <p className="setlist-meta flex items-center gap-3 text-sm text-muted-foreground">
        {t.common.songCount(sets.flatMap((s) => s.songs).length)} · {formatDuration(total) || '0:00'}
        {status && (
          <Badge role="status" variant={status === 'error' ? 'destructive' : 'secondary'} className={cn('save-status', status)}>
            {{ saving: t.setlist.saving, saved: t.common.saved, error: t.setlist.notSaved }[status]}
          </Badge>
        )}
      </p>

      {shown.length === 0 && <p className="text-muted-foreground">{t.common.noSetlistYet}</p>}

      {shown.map((set, i) => (
        <section key={i} className="set rounded-xl border bg-card p-4" data-drop-zone>
          <h2 className="flex items-center gap-3">
            {editable ? (
              <Input
                aria-label={t.setlist.setName(i + 1)}
                className="h-8 max-w-[70%] text-base font-semibold md:text-base"
                value={set.name}
                maxLength={60}
                onChange={(e) => setSets(updateSet(i, { name: e.target.value }))}
                onBlur={() => persist(shown)}
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
            onDrop={drop}
            onChange={(songs) => persist(songs.length || !set.songs.length ? updateSet(i, { songs }) : shown.filter((_, j) => j !== i))}
          />
        </section>
      ))}

      {editable && (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => persist([...shown, { name: t.setlist.setN(shown.length + 1), songs: [] }])}>
            <Plus aria-hidden /> {t.setlist.addSet}
          </Button>
        </div>
      )}
    </div>
  )
}
