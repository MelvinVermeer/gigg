import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { SongListEditor, totalDuration } from '#/components/SongListEditor'
import type { SongRef } from '#/components/SongListEditor'
import { formatDate } from '#/lib/date'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/$event/setlist')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Setlist,
})

const bandRoute = getRouteApi('/$band')

type Set = { name: string; songs: SongRef[] }

function Setlist() {
  const data = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const editable = band.role === 'member'
  const [sets, setSets] = useState<Set[]>(data.sets)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error' | ''>('')
  const [blockFor, setBlockFor] = useState<Record<number, string>>({})
  const [copyFrom, setCopyFrom] = useState(data.copyFrom[0]?.slug ?? '')
  const queue = useRef(Promise.resolve())

  /** Every change saves the whole setlist; saves run one after another, in order. */
  function persist(next: Set[]) {
    setSets(next)
    setStatus('saving')
    const body = next.map((s) => ({ name: s.name.trim() || 'Set', songIds: s.songs.map((song) => song.id) }))
    queue.current = queue.current
      .then(() => bandOp('saveSetlist', band.slug, { event: data.event.slug, sets: body }))
      .then(
        () => setStatus('saved'),
        () => setStatus('error'),
      )
  }

  const updateSet = (i: number, patch: Partial<Set>) => sets.map((s, j) => (j === i ? { ...s, ...patch } : s))

  async function copy() {
    setStatus('saving')
    await bandOp('copySetlist', band.slug, { event: data.event.slug, from: copyFrom })
    const fresh = await bandOp('getSetlist', band.slug, { event: data.event.slug })
    setSets(fresh.sets)
    setStatus('saved')
  }

  const total = totalDuration(sets.flatMap((s) => s.songs))

  return (
    <>
      <p>
        <Link to="/$band/events/$event" params={{ band: band.slug, event: data.event.slug }}>
          ← {data.event.title}
        </Link>{' '}
        · {formatDate(data.event.date)}
        {sets.length > 0 && (
          <>
            {' · '}
            <Link to="/$band/events/$event/show" params={{ band: band.slug, event: data.event.slug }}>
              Show mode
            </Link>
          </>
        )}
      </p>
      <h1>Setlist</h1>
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
                  {data.copyFrom.map((e) => (
                    <option key={e.slug} value={e.slug}>
                      {formatDate(e.date)} · {e.title}
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
            band={band.slug}
            label={set.name}
            songs={set.songs}
            repertoire={data.songs}
            editable={editable}
            onChange={(songs) => persist(updateSet(i, { songs }))}
          />
          {editable && (
            <p className="row">
              {data.blocks.length > 0 && (
                <>
                  <select
                    aria-label={`Block to add to ${set.name}`}
                    value={blockFor[i] ?? data.blocks[0].id}
                    onChange={(e) => setBlockFor({ ...blockFor, [i]: e.target.value })}
                  >
                    {data.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.songs.length})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const block = data.blocks.find((b) => b.id === (blockFor[i] ?? data.blocks[0].id))!
                      persist(updateSet(i, { songs: [...set.songs, ...block.songs] }))
                    }}
                  >
                    Add block
                  </button>
                </>
              )}
              <button type="button" onClick={() => persist(sets.filter((_, j) => j !== i))}>
                Remove set
              </button>
            </p>
          )}
        </section>
      ))}

      {editable && sets.length > 0 && (
        <p>
          <button type="button" onClick={() => persist([...sets, { name: `Set ${sets.length + 1}`, songs: [] }])}>
            Add set
          </button>{' '}
          · <Link to="/$band/blocks" params={{ band: band.slug }}>Manage blocks</Link>
        </p>
      )}
    </>
  )
}
