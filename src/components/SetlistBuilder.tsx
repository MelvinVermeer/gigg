import { Link, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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
    <>
      <p className="setlist-meta">
        {sets.flatMap((s) => s.songs).length} songs · {formatDuration(total) || '0:00'}
        {status && (
          <span role="status" className={`save-status ${status}`}>
            {{ saving: 'Saving…', saved: 'Saved', error: 'Not saved, try again' }[status]}
          </span>
        )}
      </p>

      {sets.length === 0 &&
        (editable ? (
          <div className="stack">
            <p>
              <button type="button" onClick={() => persist([{ name: 'Set 1', songs: [] }])}>
                Start an empty setlist
              </button>
            </p>
            {data.copyFrom.length > 0 && (
              <p className="row">
                <select aria-label="Copy setlist from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  {data.copyFrom.map((s) => (
                    <option key={s.id} value={s.id}>
                      {copyLabel(s)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={copy}>
                  Copy that setlist
                </button>
              </p>
            )}
          </div>
        ) : (
          <p>No setlist yet.</p>
        ))}

      {sets.map((set, i) => (
        <section key={i} className="set">
          <h2>
            {editable ? (
              <input
                aria-label={`Name of set ${i + 1}`}
                value={set.name}
                maxLength={60}
                onChange={(e) => setSets(updateSet(i, { name: e.target.value }))}
                onBlur={() => persist(sets)}
              />
            ) : (
              set.name
            )}{' '}
            <small>{formatDuration(totalDuration(set.songs)) || '0:00'}</small>
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
        <p>
          <button type="button" onClick={() => persist([...sets, { name: `Set ${sets.length + 1}`, songs: [] }])}>
            Add set
          </button>{' '}
          · <Link to="/$band/blocks" params={{ band }}>Manage blocks</Link>
        </p>
      )}
    </>
  )
}
