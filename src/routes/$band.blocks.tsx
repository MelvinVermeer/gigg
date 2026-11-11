import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SongListEditor, totalDuration } from '#/components/SongListEditor'
import type { SongRef } from '#/components/SongListEditor'
import { formatDuration } from '#/lib/duration'
import { ChevronDown, Plus } from 'lucide-react'
import { Field } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import { HistoryLink } from '#/components/HistoryLink'

export const Route = createFileRoute('/$band/blocks')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listBlocks', params.band, { archived: deps.archived }),
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
  const { archived } = Route.useSearch()

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await bandOp('saveBlock', band.slug, { name, songIds: [] })
    setName('')
    await router.invalidate()
  }

  return (
    <>
      <h1>{archived ? 'Archived blocks' : 'Blocks'}</h1>
      {archived ? (
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/$band/blocks" params={{ band: band.slug }}>
            Back to blocks
          </Link>
        </Button>
      ) : (
        <p className="mb-6 text-muted-foreground">Reusable runs of songs, like an acoustic bit or the encore. Adding a block to a set copies its songs.</p>
      )}
      {!archived && editable && (
        <form className="mb-6 flex gap-2" onSubmit={create}>
          <Input aria-label="New block name" placeholder="e.g. Encore" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">
            <Plus aria-hidden /> Create block
          </Button>
        </form>
      )}
      {blocks.length ? (
        <ul className="records divide-y rounded-xl border bg-card">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} repertoire={songs} editable={editable} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{archived ? 'No archived blocks.' : 'No blocks yet.'}</p>
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
    <li>
      <details className="group">
        <summary className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
          <span className="grid flex-1 gap-0.5">
            <span className="font-medium">{block.name}</span>
            <span className="text-sm text-muted-foreground">
              {block.songs.length} songs · {formatDuration(totalDuration(block.songs)) || '0:00'}
            </span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t px-4 py-4">
          {editable && (
            <Field label="Name">
              <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </Field>
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
            <div className="flex flex-wrap items-center gap-2">
              {!block.archivedAt && <Button onClick={save}>Save</Button>}
              <Button variant="outline" onClick={() => setArchived(!block.archivedAt)}>
                {block.archivedAt ? 'Restore' : 'Archive'}
              </Button>
              <HistoryLink item={block.id} />
              {status && (
                <span role="status" className="text-sm text-muted-foreground">
                  {status}
                </span>
              )}
            </div>
          )}
        </div>
      </details>
    </li>
  )
}
