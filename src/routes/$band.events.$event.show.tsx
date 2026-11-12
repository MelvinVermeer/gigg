import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { ShowMode } from '#/components/SetlistViews'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/$event/show')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Show,
})

const bandRoute = getRouteApi('/$band')

function Show() {
  const { event, sets } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  return <ShowMode title={event.title} sets={sets} back={(p) => <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }} {...p} />} />
}
