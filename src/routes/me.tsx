import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { getMyBands } from '#/server/fns'

export const Route = createFileRoute('/me')({
  loader: async () => {
    const bands = await getMyBands()
    if (bands.length === 1) throw redirect({ to: '/$band', params: { band: bands[0].slug } })
    return bands
  },
  component: MyBands,
})

function MyBands() {
  const bands = Route.useLoaderData()
  return (
    <main>
      <h1>My bands</h1>
      {bands.length ? (
        <ul>
          {bands.map((b) => (
            <li key={b.slug}>
              <Link to="/$band" params={{ band: b.slug }}>
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>You're not in a band yet.</p>
      )}
    </main>
  )
}
