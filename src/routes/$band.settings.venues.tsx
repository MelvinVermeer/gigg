import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { RecordList } from '#/components/RecordList'
import type { Field } from '#/components/RecordList'
import { bandOp } from '#/server/fns'
import type { VenueFields } from '#/server/ops'

export const Route = createFileRoute('/$band/settings/venues')({
  loader: ({ params }) => bandOp('listVenues', params.band, {}),
  component: Venues,
})

const bandRoute = getRouteApi('/$band')

const fields: Field[] = [
  { name: 'name', label: 'Name', required: true, max: 200 },
  { name: 'address', label: 'Address', max: 500 },
  { name: 'notes', label: 'Notes', type: 'textarea', max: 10_000 },
]

function Venues() {
  const venues = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  return (
    <>
      <h1>Venues</h1>
      <RecordList
        items={venues}
        fields={fields}
        detail={(v) => v.address}
        canEdit={band.role === 'member'}
        onSave={async (id, values) => {
          await bandOp('updateVenue', band.slug, { id, fields: values as VenueFields })
          await router.invalidate()
        }}
        onArchive={async (id, archived) => {
          await bandOp(archived ? 'archiveVenue' : 'restoreVenue', band.slug, { id })
          await router.invalidate()
        }}
      />
    </>
  )
}
