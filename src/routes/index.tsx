import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { currentBand } from '#/lib/current-band'
import { Homepage } from '#/components/Homepage'

export const Route = createFileRoute('/')({ component: Home })
const rootRoute = getRouteApi('__root__')

function Home() {
  const bands = rootRoute.useLoaderData().user?.bands ?? []
  const navigate = useNavigate()
  // Members open on their current band. Client-side, so `/` itself stays a cacheable page (offline launch).
  useEffect(() => {
    const band = currentBand(bands, document.cookie)
    if (band) navigate({ to: '/$band', params: { band: band.slug }, replace: true })
  }, [bands, navigate])
  if (bands.length) return null
  return <Homepage />
}
