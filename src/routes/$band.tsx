import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band')({
  loader: ({ params }) => bandOp('getBand', params.band, {}),
  component: BandLayout,
})

function BandLayout() {
  const band = Route.useLoaderData()
  return (
    <main>
      <p className="band-nav">
        <Link to="/$band/events" params={{ band: band.slug }}>Events</Link> ·{' '}
        <Link to="/$band/setlists" params={{ band: band.slug }}>Setlists</Link>
      </p>
      <Outlet />
    </main>
  )
}
