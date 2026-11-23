import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { getFeedbackGoesPublic, sendFeedback } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'

export const Route = createFileRoute('/$band/feedback')({ loader: () => getFeedbackGoesPublic(), component: Feedback })

const bandRoute = getRouteApi('/$band')

function Feedback() {
  const band = bandRoute.useLoaderData()
  const goesPublic = Route.useLoaderData()
  const t = useT()
  const online = useOnline()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setError('')
    try {
      await sendFeedback({ data: { band: band.slug, body: String(new FormData(form).get('body')) } })
      form.reset()
      setSent(true)
    } catch {
      setError(t.feedback.failed)
    }
  }

  return (
    <>
      <h1>{t.feedback.title}</h1>
      <p className="mb-6 text-muted-foreground">
        {t.feedback.intro}
        {goesPublic && <> {t.feedback.public}</>}
      </p>
      {/* hidden, not removed: a half-written message survives a dropped connection. */}
      <form hidden={!online} onSubmit={send} onChange={() => setSent(false)} className="grid gap-4">
        <Field label={t.feedback.label}>
          <Textarea name="body" required rows={6} maxLength={5000} />
        </Field>
        <div>
          <Button type="submit">{t.feedback.send}</Button>
        </div>
      </form>
      {sent && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {t.feedback.thanks}
        </p>
      )}
      <FormError>{error}</FormError>
    </>
  )
}
