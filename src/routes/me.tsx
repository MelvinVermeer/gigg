import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMyCurrentBand } from '#/server/fns'
import { useT } from '#/lib/i18n'

// Where sign-in lands: straight into the band this device last had open.
export const Route = createFileRoute('/me')({
  loader: async () => {
    const band = await getMyCurrentBand()
    if (band) throw redirect({ to: '/$band', params: { band }, search: true })
  },
  component: NoBand,
})

function NoBand() {
  const t = useT()
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <p className="text-muted-foreground">{t.me.noBand}</p>
    </main>
  )
}
