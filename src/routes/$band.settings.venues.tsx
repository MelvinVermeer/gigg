import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { RecordList } from '#/components/RecordList'
import type { Field } from '#/components/RecordList'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import type { VenueFields } from '#/server/ops'

export const Route = createFileRoute('/$band/settings/venues')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listVenues', params.band, { archived: deps.archived }),
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
  const { archived } = Route.useSearch()
  return (
    <>
      <h1>{archived ? 'Archived venues' : 'Venues'}</h1>
      {archived && (
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/$band/settings/venues" params={{ band: band.slug }}>
            Back to venues
          </Link>
        </Button>
      )}
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
