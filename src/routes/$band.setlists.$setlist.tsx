import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/setlists/$setlist')({
  loader: ({ params }) => bandOp('getStandaloneSetlist', params.band, { id: params.setlist }),
  component: Setlist,
})

const bandRoute = getRouteApi('/$band')

function Setlist() {
  const data = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const editable = band.role === 'member'
  const [name, setName] = useState(data.setlist.name)
  const id = data.setlist.id

  async function rename() {
    if (name.trim() && name !== data.setlist.name) await bandOp('renameSetlist', band.slug, { id, name })
  }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveSetlist' : 'restoreSetlist', band.slug, { id })
    await router.invalidate()
  }

  return (
    <>
      <p>
        <Link to="/$band/setlists" params={{ band: band.slug }}>
          ← Setlists
        </Link>
      </p>
      <h1>
        {editable ? (
          <input aria-label="Setlist name" className="title-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={rename} />
        ) : (
          data.setlist.name
        )}
      </h1>
      {data.setlist.archivedAt && <p role="status">This setlist is archived.</p>}
      <SetlistBuilder band={band.slug} target={{ setlist: id }} data={data} editable={editable && !data.setlist.archivedAt} />
      {editable && (
        <p>
          <button type="button" onClick={() => setArchived(!data.setlist.archivedAt)}>
            {data.setlist.archivedAt ? 'Restore' : 'Archive'}
          </button>
        </p>
      )}
    </>
  )
}
