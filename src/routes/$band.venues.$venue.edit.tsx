import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { HistoryLink } from '#/components/HistoryLink'
import { RecordForm } from '#/components/Records'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { bandOp } from '#/server/fns'
import type { VenueFields } from '#/server/ops'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/venues/$venue/edit')({
  loader: async ({ params }) => (await bandOp('getVenue', params.band, { slug: params.venue })).venue,
  component: EditVenue,
})

function EditVenue() {
  const venue = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const t = useT()
  const params = { band, venue: venue.slug }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveVenue' : 'restoreVenue', band, { id: venue.id })
    if (archived) await navigate({ to: '/$band/settings/venues', params: { band } })
    else await router.invalidate()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{t.records.editTitle(venue.name)}</h1>
        <HistoryLink item={venue.id} />
      </div>
      {venue.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.records.venueArchived}
        </p>
      )}
      <RecordForm
        initial={venue}
        fields={[
          { name: 'name', label: t.common.name, required: true, max: 200 },
          { name: 'address', label: t.common.address, max: 500 },
          { name: 'notes', label: t.common.notes, type: 'textarea', max: 10_000 },
        ]}
        onSubmit={async (values) => {
          await bandOp('updateVenue', band, { id: venue.id, fields: values as VenueFields })
          await navigate({ to: '/$band/venues/$venue', params })
        }}
      />
      <Separator className="my-8" />
      <Button variant="outline" onClick={() => setArchived(!venue.archivedAt)}>
        {venue.archivedAt ? t.common.restore : t.common.archive}
      </Button>
    </>
  )
}
