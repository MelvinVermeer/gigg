import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { addBand, deleteBand, deleteBandPermanently, getAllBands, getFeedback } from '#/server/fns'

export const Route = createFileRoute('/admin')({
  loader: async () => ({ bands: await getAllBands(), feedback: await getFeedback() }),
  component: Admin,
})

function Admin() {
  const { bands, feedback } = Route.useLoaderData()
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
      await router.invalidate() // the band may exist even if the invite mail failed
    }
  }

  async function remove(slug: string, name: string) {
    if (!confirm(`Delete ${name}? Nobody will be able to open it any more.`)) return
    await deleteBand({ data: { slug } })
    await router.invalidate()
  }

  async function removeForever(slug: string, name: string) {
    if (prompt(`This erases all of ${name}'s songs, gigs, setlists and history. Type the band name to confirm.`) !== name) return
    await deleteBandPermanently({ data: { slug } })
    await router.invalidate()
  }

  const active = bands.filter((b) => !b.archivedAt)
  const deleted = bands.filter((b) => b.archivedAt)

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
        {active.length ? (
          <ul>
            {active.map((b) => (
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

      <section>
        <h2>Feedback</h2>
        {feedback.length ? (
          <ul aria-label="Feedback">
            {feedback.map((f) => (
              <li key={f.id}>
                <strong>{f.email}</strong>
                {f.band && <> in {f.band}</>}, {new Date(f.createdAt).toLocaleDateString()}
                <p className="notes">{f.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No feedback yet.</p>
        )}
      </section>

      {deleted.length > 0 && (
        <section>
          <h2>Deleted bands</h2>
          <p>Hidden from everyone, but their data is still stored.</p>
          <ul>
            {deleted.map((b) => (
              <li key={b.slug}>
                {b.name} ({b.members.join(', ') || 'no members'}){' '}
                <button type="button" onClick={() => removeForever(b.slug, b.name)}>
                  Delete permanently
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
