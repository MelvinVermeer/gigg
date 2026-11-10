import { Link } from '@tanstack/react-router'
import { useId, useMemo, useState } from 'react'
import { formatDuration } from '#/lib/duration'
import { withLabels } from '#/lib/labels'

export type SongRef = { id: string; slug: string; title: string; key: string | null; durationSec: number | null }

type Props = {
  band: string
  /** What the list is, for screen readers: "Set 1", "Encore". */
  label: string
  songs: SongRef[]
  repertoire: SongRef[]
  editable: boolean
  onChange: (songs: SongRef[]) => void
}

export const totalDuration = (songs: SongRef[]) => songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)

/** An ordered list of songs: move up/down, remove, add from the repertoire. Used for sets and blocks. */
export function SongListEditor({ band, label, songs, repertoire, editable, onChange }: Props) {
  const listId = useId()
  const [text, setText] = useState('')
  const options = useMemo(() => withLabels(repertoire, (s) => s.title, (s) => s.key), [repertoire])

  function add() {
    const song = options.find((o) => o.label === text.trim())
    if (!song) return
    onChange([...songs, song])
    setText('')
  }

  const move = (i: number, by: number) => {
    const next = [...songs]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }

  return (
    <>
      {songs.length ? (
        <ol className="song-list">
          {songs.map((s, i) => (
            <li key={`${s.id}-${i}`}>
              <span className="title">
                <Link to="/$band/songs/$song" params={{ band, song: s.slug }}>
                  {s.title}
                </Link>
              </span>
              <span className="key">{s.key}</span>
              <span className="duration">{formatDuration(s.durationSec)}</span>
              {editable && (
                <span className="actions">
                  <button type="button" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${s.title} down`}
                    disabled={i === songs.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${s.title}`}
                    onClick={() => onChange(songs.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">No songs yet.</p>
      )}
      {editable && (
        <span className="row add-song">
          <input
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
            placeholder="Search a song"
            autoComplete="off"
          />
          <button type="button" onClick={add}>
            Add song
          </button>
          <datalist id={listId}>
            {options.map((o) => (
              <option key={o.id} value={o.label} />
            ))}
          </datalist>
        </span>
      )}
    </>
  )
}
