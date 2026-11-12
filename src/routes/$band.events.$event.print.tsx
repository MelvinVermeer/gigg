import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { StagePrint } from '#/components/SetlistViews'
import { formatWhen } from '#/lib/date'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/events/$event/print')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Print,
})

const bandRoute = getRouteApi('/$band')

function Print() {
  const { event, sets } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const t = useT()
  return (
    <StagePrint
      title={`${event.title} · ${formatWhen(event, t.intl)}`}
      sets={sets}
      back={(p) => <Link to="/$band/events/$event/setlist" params={{ band: band.slug, event: event.slug }} {...p} />}
    />
  )
}
