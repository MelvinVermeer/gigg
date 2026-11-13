import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { Check, MonitorPlay, Pencil, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'

export const Route = createFileRoute('/$band/setlists/$setlist/')({
  loader: ({ params }) => bandOp('getStandaloneSetlist', params.band, { id: params.setlist }),
  component: Setlist,
})

const bandRoute = getRouteApi('/$band')

function Setlist() {
  const data = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const member = band.role === 'member'
  const online = useOnline()
  // A new, empty setlist opens ready to build.
  const [editing, setEditing] = useState(data.sets.length === 0)
  const editable = member && editing
  const [name, setName] = useState(data.setlist.name)
  const id = data.setlist.id
  const params = { band: band.slug, setlist: id }
  const t = useT()
  const nameInput = useRef<HTMLInputElement>(null)

  // An empty setlist (usually just created) opens with its name selected, ready to type over.
  useEffect(() => {
    if (data.sets.length === 0) nameInput.current?.select()
    // Only on opening, not when the last set is removed while editing.
  }, [id])

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
              ref={nameInput}
              aria-label={t.setlist.name}
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
        {/* Offline you can't start editing, but an edit already open stays (and can be closed). */}
        {member && (online || editing) && (
          <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? <Check aria-hidden /> : <Pencil aria-hidden />} {editing ? t.common.done : t.common.edit}
          </Button>
        )}
      </div>
      {data.sets.length > 0 && !editing && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/setlists/$setlist/show" params={params}>
              <MonitorPlay aria-hidden /> {t.setlist.showMode}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/setlists/$setlist/print" params={params}>
              <Printer aria-hidden /> {t.setlist.stagePdf}
            </Link>
          </Button>
        </div>
      )}
      {data.setlist.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.setlist.isArchived}
        </p>
      )}
      <SetlistBuilder band={band.slug} target={{ setlist: id }} data={data} editable={editable && !data.setlist.archivedAt} />
      {editable && (
        <>
          <Separator className="my-8" />
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setArchived(!data.setlist.archivedAt)}>
              {data.setlist.archivedAt ? t.common.restore : t.common.archive}
            </Button>
            <HistoryLink item={id} />
          </div>
        </>
      )}
    </>
  )
}
