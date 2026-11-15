import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '#/lib/date'
import { Field, FormError } from '#/components/Field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { AnswerPicker } from '#/components/Availability'
import { Textarea } from '#/components/ui/textarea'
import { answerAvailabilityByToken, getAvailabilityByToken } from '#/server/fns'
import { LocaleOverride, dicts, errorText } from '#/lib/i18n'

// Reached from the emailed links: ?answer=yes|no|maybe preselects, a button confirms (a link scanner opening the mail records nothing).
export const Route = createFileRoute('/availability/$token')({
  validateSearch: (s: Record<string, unknown>) => ({ answer: ['yes', 'no', 'maybe'].includes(String(s.answer)) ? (s.answer as 'yes' | 'no' | 'maybe') : undefined }),
  loader: ({ params }) => getAvailabilityByToken({ data: { token: params.token } }),
  component: Answer,
})

function Answer() {
  const r = Route.useLoaderData()
  const { token } = Route.useParams()
  const search = Route.useSearch()
  const router = useRouter()
  // In the recipient's language, also when someone else is signed in on this device.
  const t = dicts[r.locale]
  const labels = t.answer
  const [choice, setChoice] = useState<keyof typeof labels | undefined>(search.answer ?? r.answer ?? undefined)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!choice) return
    try {
      await answerAvailabilityByToken({ data: { token, answer: choice, note: String(new FormData(e.currentTarget).get('note') ?? '') } })
      setSaved(true)
      setError('')
      await router.invalidate()
    } catch (err) {
      setError(errorText(t, err, t.common.somethingWrong))
    }
  }

  return (
    <LocaleOverride.Provider value={r.locale}>
      <main lang={r.locale} className="mx-auto w-full max-w-md px-4 pt-12 pb-16">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={1} className="text-xl">
              {t.availability.canYouMakeIt}
            </CardTitle>
            <CardDescription>
              <strong className="text-foreground">{r.event}</strong>
              {r.venue && t.availability.at(r.venue)}
              <br />
              {formatDate(r.date, t.intl)} · {r.band}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {r.closed && (
              <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
                {t.availability.closedLink}
              </p>
            )}
            {!r.closed && r.stale && (
              <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
                {t.availability.staleLink}
              </p>
            )}
            {!r.closed && (
            <form onSubmit={submit} className="grid gap-5">
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">{t.availability.yourAnswer}</legend>
                  <AnswerPicker value={choice} onChange={setChoice} />
                </fieldset>
                {choice === 'maybe' && (
                  <Field label={t.availability.whyMaybeOptional}>
                    <Textarea name="note" maxLength={500} rows={2} defaultValue={r.note ?? ''} />
                  </Field>
                )}
                <Button type="submit" disabled={!choice}>
                  {r.answer ? t.availability.change : t.availability.confirm}
                </Button>
                {saved && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {choice && t.availability.recorded(labels[choice])}
                  </p>
                )}
                <FormError>{error}</FormError>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </LocaleOverride.Provider>
  )
}
