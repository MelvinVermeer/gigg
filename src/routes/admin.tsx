import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { addBand, deleteBand, deleteBandPermanently, getAllBands, getFeedback } from '#/server/fns'

const size = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : b < 1024 ** 3 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(2)} GB`)

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
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1>Admin</h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Add a band
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form onSubmit={add} className="flex flex-wrap items-end gap-2">
              <Field label="Band name" className="min-w-40 flex-1">
                <Input name="name" required maxLength={200} />
              </Field>
              <Field label="First member's email" className="min-w-48 flex-1">
                <Input name="email" type="email" required maxLength={200} />
              </Field>
              <Button type="submit">Add band</Button>
            </form>
            <FormError>{error}</FormError>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Bands
            </CardTitle>
          </CardHeader>
          <CardContent>
            {active.length ? (
              <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
                {active.map((b) => (
                  <li key={b.slug} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <Link to="/$band" params={{ band: b.slug }} className="font-medium hover:underline">
                        {b.name}
                      </Link>
                      <span className="truncate text-muted-foreground" title={b.members.join(', ')}>
                        {b.members.length} members · files: {size(b.fileBytes)} · {b.members.join(', ')}
                      </span>
                    </span>
                    <Button variant="ghost" size="xs" className="text-destructive" onClick={() => remove(b.slug, b.name)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No bands yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feedback.length ? (
              <ul aria-label="Feedback" className="max-h-[32rem] divide-y overflow-y-auto rounded-lg border">
                {feedback.map((f) => (
                  <li key={f.id} className="grid gap-1 px-3 py-2 text-sm">
                    <span>
                      <strong>{f.name || f.email}</strong>
                      <span className="text-muted-foreground">
                        {f.band && <> in {f.band}</>}, {new Date(f.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                    <p className="notes whitespace-pre-wrap">{f.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            )}
          </CardContent>
        </Card>

        {deleted.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Deleted bands
              </CardTitle>
              <CardDescription>Hidden from everyone, but their data is still stored.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
                {deleted.map((b) => (
                  <li key={b.slug} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate" title={b.members.join(', ')}>
                      {b.name}{' '}
                      <span className="text-muted-foreground">
                        ({b.members.join(', ') || 'no members'}), files: {size(b.fileBytes)}
                      </span>
                    </span>
                    <Button variant="destructive" size="xs" onClick={() => removeForever(b.slug, b.name)}>
                      Delete permanently
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
