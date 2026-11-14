import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { bandOp } from '#/server/fns'
import { rememberBand } from '#/lib/current-band'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band')({
  loader: ({ params }) => bandOp('getBand', params.band, {}),
  component: BandLayout,
})

const tab = 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
const active = { className: 'bg-muted text-foreground' }

function BandLayout() {
  const band = Route.useLoaderData()
  const t = useT()
  useEffect(() => rememberBand(band.slug), [band.slug])
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-16">
      <nav className="band-nav mb-6 flex items-center gap-1" aria-label={band.name}>
        <span className="mr-3 font-semibold">{band.name}</span>
        <Link to="/$band/events" params={{ band: band.slug }} className={tab} activeProps={active}>
          {t.common.events}
        </Link>
        <Link to="/$band/setlists" params={{ band: band.slug }} className={tab} activeProps={active}>
          {t.common.setlists}
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}
