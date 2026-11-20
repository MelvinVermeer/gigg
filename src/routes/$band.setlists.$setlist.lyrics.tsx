import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { ShowMode } from '#/components/SetlistViews'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/setlists/$setlist/lyrics')({
  loader: ({ params }) => bandOp('getStandaloneSetlist', params.band, { id: params.setlist }),
  component: Show,
})

const bandRoute = getRouteApi('/$band')

function Show() {
  const { setlist, sets } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  return <ShowMode title={setlist.name} sets={sets} lyrics back={(p) => <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: setlist.id }} {...p} />} />
}
