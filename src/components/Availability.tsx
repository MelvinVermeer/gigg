import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { formatDate } from '#/lib/date'
import { askAvailability, bandOp } from '#/server/fns'

type Info = NonNullable<Awaited<ReturnType<typeof bandOp<'getAvailability'>>>>
type Answer = 'yes' | 'maybe' | 'no'
const labels = { yes: 'Yes', maybe: 'Maybe', no: 'No' } as const
const answerBadge = { yes: 'default', maybe: 'secondary', no: 'destructive' } as const

/** "all 5 yes", or "5 yes / 2 no / 1 maybe / 1 waiting" (zero counts left out). */
export function summarize(responses: { answer: Answer | null }[]) {
  const n = (a: Answer | null) => responses.filter((r) => r.answer === a).length
  if (n('yes') === responses.length) return `all ${responses.length} yes`
  return (
    [
      [n('yes'), 'yes'],
      [n('no'), 'no'],
      [n('maybe'), 'maybe'],
      [n(null), 'waiting'],
    ] as const
  )
    .filter(([c]) => c)
    .map(([c, w]) => `${c} ${w}`)
    .join(' / ')
}

/** Run a change, then reload the page data; returns the error message, if any. */
function useRun() {
  const router = useRouter()
  const [error, setError] = useState('')
  const run = async (go: () => Promise<unknown>) => {
    try {
      await go()
      setError('')
      await router.invalidate()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return false
    }
  }
  return { run, error }
}

function Responses({ info, onEdit }: { info: Info; onEdit?: () => void }) {
  return (
    <ul className="divide-y">
      {info.responses.map((r) => (
        <li key={r.email} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="font-medium">{r.name || r.email}:</span>
          {r.answer ? <Badge variant={answerBadge[r.answer]}>{labels[r.answer]}</Badge> : <Badge variant="outline">waiting</Badge>}
          {r.note && <span className="text-muted-foreground">“{r.note}”</span>}
          {r.mine && r.answer && onEdit && (
            <Button variant="ghost" size="xs" className="ml-auto" onClick={onEdit}>
              Edit
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Pick people and send them the question. Nobody is preselected. */
function Ask({ band, event, label = 'Check availability' }: { band: string; event: string; label?: string }) {
  const { run, error } = useRun()
  const [people, setPeople] = useState<{ email: string; name: string; role: string }[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  if (!people)
    return (
      <div>
        <Button variant="outline" onClick={async () => setPeople(await bandOp('listMembers', band, {}))}>
          {label}
        </Button>
      </div>
    )
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await run(() => askAvailability({ data: { band, event, emails: [...picked] } }))) setPeople(null)
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Ask who?</legend>
        <Label className="font-normal">
          <Checkbox checked={picked.size === people.length} onCheckedChange={(c) => setPicked(new Set(c === true ? people.map((p) => p.email) : []))} />
          Select all
        </Label>
        {people.map((p) => (
          <Label key={p.email} className="font-normal">
            <Checkbox
              checked={picked.has(p.email)}
              onCheckedChange={(c) => {
                const next = new Set(picked)
                if (c === true) next.add(p.email)
                else next.delete(p.email)
                setPicked(next)
              }}
            />
            {p.name || p.email} <span className="text-muted-foreground">({p.role})</span>
          </Label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={!picked.size}>
          Send request
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPeople(null)}>
          Cancel
        </Button>
      </div>
      <FormError>{error}</FormError>
    </form>
  )
}

/** "Can you make it?" while asking (or before anyone was asked). A closed check shows as <AvailabilitySummary>. */
export function Availability({ band, event, info, canAsk }: { band: string; event: string; info: Info | null; canAsk: boolean }) {
  const { run, error } = useRun()
  const [editing, setEditing] = useState(false)
  const mine = info?.responses.find((r) => r.mine)
  const [answer, setAnswer] = useState<Answer | undefined>(mine?.answer ?? undefined)

  if (info ? !info.open : !canAsk) return null
  return (
    <Card aria-labelledby="availability" role="region" className="mt-6">
      <CardHeader>
        <CardTitle id="availability" role="heading" aria-level={2}>
          Availability
        </CardTitle>
        {info && (
          <CardDescription>
            Asking for {formatDate(info.date)}: {summarize(info.responses)}
          </CardDescription>
        )}
        {info && canAsk && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => run(() => bandOp('closeAvailability', band, { event }))}>
              Close request
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {!info && <Ask band={band} event={event} />}
        {info && (
          <>
            {info.stale && (
              <p role="status" className="text-sm text-muted-foreground">
                The event has moved since people were asked.
              </p>
            )}
            <Responses info={info} onEdit={editing ? undefined : () => setEditing(true)} />
            {mine && (!mine.answer || editing) && (
              <form
                className="grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const note = String(new FormData(e.currentTarget).get('note') ?? '').trim() || null
                  if (await run(() => bandOp('answerAvailability', band, { event, answer: answer!, note }))) setEditing(false)
                }}
              >
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">Your answer</legend>
                  <RadioGroup value={answer ?? ''} onValueChange={(v) => setAnswer(v as Answer)} required className="flex gap-4">
                    {(Object.keys(labels) as Answer[]).map((a) => (
                      <Label key={a} className="font-normal">
                        <RadioGroupItem value={a} /> {labels[a]}
                      </Label>
                    ))}
                  </RadioGroup>
                </fieldset>
                <div className="flex gap-2">
                  {answer === 'maybe' && <Input name="note" aria-label="Note" placeholder="Why maybe?" defaultValue={mine.note ?? ''} maxLength={500} />}
                  <Button type="submit" disabled={!answer}>
                    Save
                  </Button>
                  {editing && (
                    <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  )
}

function Reopen({ band, event }: { band: string; event: string }) {
  const { run, error } = useRun()
  return (
    <div>
      <Button variant="outline" onClick={() => run(() => bandOp('reopenAvailability', band, { event }))}>
        Reopen request
      </Button>
      <FormError>{error}</FormError>
    </div>
  )
}

/** The closed check as a row in the event's field list; clicking opens everyone's answers. */
export function AvailabilitySummary({ band, event, info, canAsk }: { band: string; event: string; info: Info | null; canAsk: boolean }) {
  if (!info || info.open) return null
  return (
    <>
      <dt className="text-muted-foreground">Availability</dt>
      <dd>
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="text-left font-medium underline-offset-4 hover:underline">
              {summarize(info.responses)}
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Availability</DialogTitle>
              <DialogDescription>
                Asked for {formatDate(info.date)}
                {info.stale && ' (the event has moved since)'}
              </DialogDescription>
            </DialogHeader>
            <Responses info={info} />
            {canAsk && <Reopen band={band} event={event} />}
            {canAsk && <Ask band={band} event={event} label="New availability check" />}
          </DialogContent>
        </Dialog>
      </dd>
    </>
  )
}
