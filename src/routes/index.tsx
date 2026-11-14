import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { currentBand } from '#/lib/current-band'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/')({ component: Home })
const rootRoute = getRouteApi('__root__')

function Home() {
  const t = useT()
  const bands = rootRoute.useLoaderData().user?.bands ?? []
  const navigate = useNavigate()
  // Members open on their current band. Client-side, so `/` itself stays a cacheable page (offline launch).
  useEffect(() => {
    const band = currentBand(bands, document.cookie)
    if (band) navigate({ to: '/$band', params: { band: band.slug }, replace: true })
  }, [bands, navigate])
  if (bands.length) return null
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1 className="mt-16 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">{t.home.tagline}</h1>
    </main>
  )
}
