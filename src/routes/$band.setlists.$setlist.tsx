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
      <div className="flex justify-end">
        <HistoryLink item={id} />
      </div>
      <h1 className="mt-1">
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
          data.setlist.name
        )}
      </h1>
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
