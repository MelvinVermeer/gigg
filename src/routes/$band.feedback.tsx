import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
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
      <p>Something broken, confusing or missing? Tell us. It goes to whoever runs this Gigg.</p>
      <form onSubmit={send} onChange={() => setSent(false)}>
        <p>
          <label>
            Your feedback
            <br />
            <textarea name="body" required rows={6} maxLength={5000} style={{ width: '100%' }} />
          </label>
        </p>
        <button type="submit">Send feedback</button>
      </form>
      {sent && <p role="status">Thanks, we got it.</p>}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
