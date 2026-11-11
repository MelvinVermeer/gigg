import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { askAvailability, bandOp } from '#/server/fns'

type Info = Awaited<ReturnType<typeof bandOp<'getAvailability'>>>
const labels = { yes: 'Yes', maybe: 'Maybe', no: 'No' } as const

/** "Can you make it?" on the event page: members ask people, everyone asked answers, all see the answers. */
export function Availability({ band, event, info, canAsk }: { band: string; event: string; info: Info; canAsk: boolean }) {
  const router = useRouter()
  const [people, setPeople] = useState<{ email: string; role: string }[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set()) // nobody is preselected
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const run = async (go: () => Promise<unknown>) => {
    try {
      await go()
      setPeople(null)
      setEditing(false)
      setPicked(new Set())
      setError('')
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }
  const mine = info?.responses.find((r) => r.mine)

  return (
    <section aria-labelledby="availability">
      <h2 id="availability">Availability</h2>
      {info && (
        <>
          <p>
            {info.open ? 'Asking' : 'Asked'} for {info.date}
            {info.open ? '' : ' (closed)'}:{' '}
            {(['yes', 'maybe', 'no'] as const).map((a) => `${info.responses.filter((r) => r.answer === a).length} ${a}`).join(', ')},{' '}
            {info.responses.filter((r) => !r.answer).length} waiting
          </p>
          {info.stale && <p role="status">The event has moved since people were asked.</p>}
          <ul>
            {info.responses.map((r) => (
              <li key={r.email}>
                {r.name || r.email}: {r.answer ? labels[r.answer] : 'waiting'}
                {r.note && <> · “{r.note}”</>}
                {r.mine && info.open && r.answer && !editing && (
                  <>
                    {' '}
                    <button type="button" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {info.open && mine && (!mine.answer || editing) && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                run(() =>
                  bandOp('answerAvailability', band, {
                    event,
                    answer: f.get('answer') as keyof typeof labels,
                    note: String(f.get('note') ?? '').trim() || null,
                  }),
                )
              }}
            >
              <fieldset>
                <legend>Your answer</legend>
                {(Object.keys(labels) as (keyof typeof labels)[]).map((a) => (
                  <label key={a}>
                    <input type="radio" name="answer" value={a} defaultChecked={mine.answer === a} required /> {labels[a]}
                  </label>
                ))}
              </fieldset>
              <label>
                Note <input name="note" defaultValue={mine.note ?? ''} maxLength={500} />
              </label>{' '}
              <button type="submit">Save</button>
              {editing && (
                <>
                  {' '}
                  <button type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              )}
            </form>
          )}
          {info.open && canAsk && (
            <p>
              <button type="button" onClick={() => run(() => bandOp('closeAvailability', band, { event }))}>
                Close request
              </button>
            </p>
          )}
        </>
      )}
      {canAsk && !info?.open && !people && (
        <p>
          <button type="button" onClick={async () => setPeople(await bandOp('listMembers', band, {}))}>
            Check availability
          </button>
        </p>
      )}
      {people && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(() => askAvailability({ data: { band, event, emails: [...picked] } }))
          }}
        >
          <fieldset>
            <legend>Ask who?</legend>
            <label>
              <input
                type="checkbox"
                checked={picked.size === people.length}
                onChange={(e) => setPicked(new Set(e.target.checked ? people.map((p) => p.email) : []))}
              />{' '}
              Select all
            </label>
            {people.map((p) => (
              <label key={p.email}>
                <input
                  type="checkbox"
                  checked={picked.has(p.email)}
                  onChange={(e) => {
                    const next = new Set(picked)
                    if (e.target.checked) next.add(p.email)
                    else next.delete(p.email)
                    setPicked(next)
                  }}
                />{' '}
                {p.email} ({p.role})
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={!picked.size}>
            Send request
          </button>{' '}
          <button type="button" onClick={() => setPeople(null)}>
            Cancel
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
