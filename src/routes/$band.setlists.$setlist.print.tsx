import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { StagePrint } from '#/components/SetlistViews'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/setlists/$setlist/print')({
  loader: ({ params }) => bandOp('getStandaloneSetlist', params.band, { id: params.setlist }),
  component: Print,
})

const bandRoute = getRouteApi('/$band')

function Print() {
  const { setlist, sets } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  return <StagePrint title={setlist.name} sets={sets} back={(p) => <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: setlist.id }} {...p} />} />
}
