import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { getMyBands } from '#/server/fns'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/me')({
  loader: async () => {
    const bands = await getMyBands()
    if (bands.length === 1) throw redirect({ to: '/$band', params: { band: bands[0].slug }, search: true })
    return bands
  },
  component: MyBands,
})

function MyBands() {
  const bands = Route.useLoaderData()
  const t = useT()
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1>{t.me.title}</h1>
      {bands.length ? (
        <ul className="divide-y rounded-xl border bg-card">
          {bands.map((b) => (
            <li key={b.slug} className="relative px-4 py-3 font-medium hover:bg-muted/50">
              <Link to="/$band" params={{ band: b.slug }} className="after:absolute after:inset-0">
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t.me.noBand}</p>
      )}
    </main>
  )
}
