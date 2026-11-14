import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { RecordList } from '#/components/Records'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/settings/venues')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listVenues', params.band, { archived: deps.archived }),
  component: Venues,
})

const bandRoute = getRouteApi('/$band')

function Venues() {
  const venues = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
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
        name={(v) => (
          <Link to="/$band/venues/$venue" params={{ band: band.slug, venue: v.slug }} className="hover:underline">
            {v.name}
          </Link>
        )}
        detail={(v) => v.address}
      />
    </>
  )
}
