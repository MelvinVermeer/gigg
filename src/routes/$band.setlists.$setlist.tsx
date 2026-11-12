import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'

export const Route = createFileRoute('/$band/setlists/$setlist')({
  loader: ({ params }) => bandOp('getStandaloneSetlist', params.band, { id: params.setlist }),
  component: Setlist,
})

const bandRoute = getRouteApi('/$band')

function Setlist() {
  const data = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const member = band.role === 'member'
  // A new, empty setlist opens ready to build.
  const [editing, setEditing] = useState(data.sets.length === 0)
  const editable = member && editing
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="mb-0 min-w-0 flex-1">
          {editable ? (
            <Input
              aria-label="Setlist name"
              className="title-input h-10 text-2xl font-semibold md:text-2xl"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onBlur={rename}
            />
          ) : (
            name
          )}
        </h1>
        {member && (
          <Button size="sm" variant={editing ? 'default' : 'secondary'} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>
      {editing && (
        <div className="mb-6 flex flex-wrap gap-2">
          <HistoryLink item={id} />
        </div>
      )}
      {data.setlist.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          This setlist is archived.
        </p>
      )}
      <SetlistBuilder band={band.slug} target={{ setlist: id }} data={data} editable={editable && !data.setlist.archivedAt} />
      {editable && (
        <>
          <Separator className="my-8" />
          <Button variant="outline" onClick={() => setArchived(!data.setlist.archivedAt)}>
            {data.setlist.archivedAt ? 'Restore' : 'Archive'}
          </Button>
        </>
      )}
    </>
  )
}
