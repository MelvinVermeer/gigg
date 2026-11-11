import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { addBand, deleteBand, getAllBands } from '#/server/fns'

export const Route = createFileRoute('/admin')({
  loader: () => getAllBands(),
  component: Admin,
})

function Admin() {
  const bands = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState('')

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await addBand({ data: { name: String(data.get('name')), email: String(data.get('email')) } })
      form.reset()
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the band')
    }
  }

  async function remove(slug: string, name: string) {
    if (!confirm(`Delete ${name}? Nobody will be able to open it any more.`)) return
    await deleteBand({ data: { slug } })
    await router.invalidate()
  }

  return (
    <main>
      <h1>Admin</h1>

      <section>
        <h2>Add a band</h2>
        <form onSubmit={add}>
          <label>
            Band name <input name="name" required maxLength={200} />
          </label>{' '}
          <label>
            First member's email <input name="email" type="email" required maxLength={200} />
          </label>{' '}
          <button type="submit">Add band</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </section>

      <section>
        <h2>Bands</h2>
        {bands.length ? (
          <ul>
            {bands.map((b) => (
              <li key={b.slug}>
                <Link to="/$band" params={{ band: b.slug }}>
                  {b.name}
                </Link>{' '}
                ({b.members.join(', ') || 'no members'}){' '}
                <button type="button" onClick={() => remove(b.slug, b.name)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No bands yet.</p>
        )}
      </section>
    </main>
  )
}
