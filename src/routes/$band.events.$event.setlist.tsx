import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { formatDate } from '#/lib/date'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'

export const Route = createFileRoute('/$band/events/$event/setlist')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Setlist,
})

const bandRoute = getRouteApi('/$band')

function Setlist() {
  const data = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const params = { band: band.slug, event: data.event.slug }

  return (
    <>
      <p>
        <Link to="/$band/events/$event" params={params}>
          ← {data.event.title}
        </Link>{' '}
        · {formatDate(data.event.date)}
        {data.sets.length > 0 && (
          <>
            {' · '}
            <Link to="/$band/events/$event/show" params={params}>
              Show mode
            </Link>
            {' · '}
            <Link to="/$band/events/$event/print" params={params}>
              Stage-floor PDF
            </Link>
          </>
        )}
        {' · '}
        <HistoryLink item={data.event.id} />
      </p>
      <h1>Setlist</h1>
      <SetlistBuilder band={band.slug} target={{ event: data.event.slug }} data={data} editable={band.role === 'member'} />
    </>
  )
}
