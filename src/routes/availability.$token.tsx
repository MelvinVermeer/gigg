import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '#/lib/date'
import { Field, FormError } from '#/components/Field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Textarea } from '#/components/ui/textarea'
import { answerAvailabilityByToken, getAvailabilityByToken } from '#/server/fns'

// Reached from the emailed links: ?answer=yes|no|maybe preselects, a button confirms (a link scanner opening the mail records nothing).
export const Route = createFileRoute('/availability/$token')({
  validateSearch: (s: Record<string, unknown>) => ({ answer: ['yes', 'no', 'maybe'].includes(String(s.answer)) ? (s.answer as 'yes' | 'no' | 'maybe') : undefined }),
  loader: ({ params }) => getAvailabilityByToken({ data: { token: params.token } }),
  component: Answer,
})

const labels = { yes: 'Yes', maybe: 'Maybe', no: 'No' } as const

function Answer() {
  const r = Route.useLoaderData()
  const { token } = Route.useParams()
  const search = Route.useSearch()
  const router = useRouter()
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
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-12 pb-16">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="text-xl">
            Can you make it?
          </CardTitle>
          <CardDescription>
            <strong className="text-foreground">{r.event}</strong>
            {r.venue && <> at {r.venue}</>}
            <br />
            {formatDate(r.date)} · {r.band}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {r.stale && (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              This event has moved since you were asked. Ask the band before answering.
            </p>
          )}
          {r.closed ? (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              This request is closed.{r.answer && <> Your answer was: {labels[r.answer]}.</>}
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-5">
              <fieldset>
                <legend className="mb-3 text-sm font-medium">Your answer</legend>
                <RadioGroup value={choice ?? ''} onValueChange={(v) => setChoice(v as keyof typeof labels)} className="flex gap-6">
                  {(Object.keys(labels) as (keyof typeof labels)[]).map((a) => (
                    <Label key={a} className="font-normal">
                      <RadioGroupItem value={a} /> {labels[a]}
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
              {choice === 'maybe' && (
                <Field label="Why maybe? (optional)">
                  <Textarea name="note" maxLength={500} rows={2} defaultValue={r.note ?? ''} />
                </Field>
              )}
              <Button type="submit" disabled={!choice}>
                {r.answer ? 'Change my answer' : 'Confirm'}
              </Button>
              {saved && (
                <p role="status" className="text-sm text-muted-foreground">
                  Recorded: {choice && labels[choice]}. You can change it until the request is closed.
                </p>
              )}
              <FormError>{error}</FormError>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
