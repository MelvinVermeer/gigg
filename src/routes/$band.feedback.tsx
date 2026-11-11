import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/feedback')({ component: Feedback })

const bandRoute = getRouteApi('/$band')

function Feedback() {
  const band = bandRoute.useLoaderData()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setError('')
    try {
      await bandOp('sendFeedback', band.slug, { body: String(new FormData(form).get('body')) })
      form.reset()
      setSent(true)
    } catch {
      setError('Could not send. Are you offline?')
    }
  }

  return (
    <>
      <h1>Feedback</h1>
      <p className="mb-6 text-muted-foreground">Something broken, confusing or missing? Tell us. It goes to whoever runs this Gigg.</p>
      <form onSubmit={send} onChange={() => setSent(false)} className="grid gap-4">
        <Field label="Your feedback">
          <Textarea name="body" required rows={6} maxLength={5000} />
        </Field>
        <div>
          <Button type="submit">Send feedback</Button>
        </div>
      </form>
      {sent && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Thanks, we got it.
        </p>
      )}
      <FormError>{error}</FormError>
    </>
  )
}
