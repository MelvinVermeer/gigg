import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '#/lib/date'
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
      await answerAvailabilityByToken({ data: { token, answer: choice, note: String(new FormData(e.currentTarget).get('note')) } })
      setSaved(true)
      setError('')
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <main>
      <h1>Can you make it?</h1>
      <p>
        <strong>{r.event}</strong>
        {r.venue && <> at {r.venue}</>}
        <br />
        {formatDate(r.date)} · {r.band}
      </p>
      {r.stale && <p role="status">This event has moved since you were asked. Ask the band before answering.</p>}
      {r.closed ? (
        <p role="status">This request is closed.{r.answer && <> Your answer was: {labels[r.answer]}.</>}</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <fieldset>
            <legend>Your answer</legend>
            {(Object.keys(labels) as (keyof typeof labels)[]).map((a) => (
              <label key={a}>
                <input type="radio" name="answer" checked={choice === a} onChange={() => setChoice(a)} /> {labels[a]}
              </label>
            ))}
          </fieldset>
          <label>
            Note (optional)
            <textarea name="note" maxLength={500} rows={2} defaultValue={r.note ?? ''} />
          </label>
          <button type="submit" disabled={!choice}>
            {r.answer ? 'Change my answer' : 'Confirm'}
          </button>
          {saved && <p role="status">Recorded: {choice && labels[choice]}. You can change it until the request is closed.</p>}
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </main>
  )
}
