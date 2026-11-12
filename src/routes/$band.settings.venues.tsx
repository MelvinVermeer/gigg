import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { RecordList } from '#/components/RecordList'
import type { Field } from '#/components/RecordList'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import type { VenueFields } from '#/server/ops'
import { useT } from '#/lib/i18n'
import type { Dict } from '#/lib/i18n'

export const Route = createFileRoute('/$band/settings/venues')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listVenues', params.band, { archived: deps.archived }),
  component: Venues,
})

const bandRoute = getRouteApi('/$band')

const fields = (t: Dict): Field[] => [
  { name: 'name', label: t.common.name, required: true, max: 200 },
  { name: 'address', label: t.common.address, max: 500 },
  { name: 'notes', label: t.common.notes, type: 'textarea', max: 10_000 },
]

function Venues() {
  const venues = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const { archived } = Route.useSearch()
  const t = useT()
  return (
    <>
      <h1>{archived ? t.records.archivedVenues : t.common.venues}</h1>
      {archived && (
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/$band/settings/venues" params={{ band: band.slug }}>
            {t.records.backToVenues}
          </Link>
        </Button>
      )}
      <RecordList
        items={venues}
        fields={fields(t)}
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
