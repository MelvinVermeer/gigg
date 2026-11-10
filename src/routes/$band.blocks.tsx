import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SongListEditor, totalDuration } from '#/components/SongListEditor'
import type { SongRef } from '#/components/SongListEditor'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/blocks')({
  loader: ({ params }) => bandOp('listBlocks', params.band, {}),
  component: Blocks,
})

const bandRoute = getRouteApi('/$band')

type Block = { id: string; name: string; archivedAt: Date | null; songs: SongRef[] }

function Blocks() {
  const { blocks, songs } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const editable = band.role === 'member'
  const [name, setName] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await bandOp('saveBlock', band.slug, { name, songIds: [] })
    setName('')
    await router.invalidate()
  }

  return (
    <>
      <h1>Blocks</h1>
      <p>Reusable runs of songs, like an acoustic bit or the encore. Adding a block to a set copies its songs.</p>
      {editable && (
        <form className="row" onSubmit={create}>
          <input aria-label="New block name" placeholder="e.g. Encore" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create block</button>
        </form>
      )}
      {blocks.length ? (
        <ul className="records">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} repertoire={songs} editable={editable} />
          ))}
        </ul>
      ) : (
        <p>No blocks yet.</p>
      )}
    </>
  )
}

function BlockRow({ block, repertoire, editable }: { block: Block; repertoire: SongRef[]; editable: boolean }) {
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState(block.name)
  const [songs, setSongs] = useState(block.songs)
  const [status, setStatus] = useState('')

  async function save() {
    await bandOp('saveBlock', band.slug, { id: block.id, name, songIds: songs.map((s) => s.id) })
    setStatus('Saved')
    await router.invalidate()
  }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveBlock' : 'restoreBlock', band.slug, { id: block.id })
    await router.invalidate()
  }

  return (
    <li className={block.archivedAt ? 'archived' : undefined}>
      <details>
        <summary>
          <strong>{block.name}</strong>
          {block.archivedAt && <small> (archived)</small>}
          <br />
          <small>
            {block.songs.length} songs · {formatDuration(totalDuration(block.songs)) || '0:00'}
          </small>
        </summary>
        <div className="stack">
          {editable && (
            <label>
              Name
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <SongListEditor
            band={band.slug}
            label={block.name}
            songs={songs}
            repertoire={repertoire}
            editable={editable && !block.archivedAt}
            onChange={(next) => {
              setSongs(next)
              setStatus('')
            }}
          />
          {editable && (
            <p>
              {!block.archivedAt && (
                <button type="button" onClick={save}>
                  Save
                </button>
              )}{' '}
              <button type="button" onClick={() => setArchived(!block.archivedAt)}>
                {block.archivedAt ? 'Restore' : 'Archive'}
              </button>{' '}
              {status && <span role="status">{status}</span>}
            </p>
          )}
        </div>
      </details>
    </li>
  )
}
