import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { askAvailability, bandOp } from '#/server/fns'

type Info = Awaited<ReturnType<typeof bandOp<'getAvailability'>>>
const labels = { yes: 'Yes', maybe: 'Maybe', no: 'No' } as const
const answerBadge = { yes: 'default', maybe: 'secondary', no: 'destructive' } as const

/** "Can you make it?" on the event page: members ask people, everyone asked answers, all see the answers. */
export function Availability({ band, event, info, canAsk }: { band: string; event: string; info: Info; canAsk: boolean }) {
  const router = useRouter()
  const [people, setPeople] = useState<{ email: string; name: string; role: string }[] | null>(null)
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
    <Card aria-labelledby="availability" role="region" className="mt-6">
      <CardHeader>
        <CardTitle id="availability" role="heading" aria-level={2}>
          Availability
        </CardTitle>
        {info && (
          <CardDescription>
            {info.open ? 'Asking' : 'Asked'} for {info.date}
            {info.open ? '' : ' (closed)'}:{' '}
            {(['yes', 'maybe', 'no'] as const).map((a) => `${info.responses.filter((r) => r.answer === a).length} ${a}`).join(', ')},{' '}
            {info.responses.filter((r) => !r.answer).length} waiting
          </CardDescription>
        )}
        {info?.open && canAsk && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => run(() => bandOp('closeAvailability', band, { event }))}>
              Close request
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {info && (
          <>
            {info.stale && (
              <p role="status" className="text-sm text-muted-foreground">
                The event has moved since people were asked.
              </p>
            )}
            <ul className="divide-y">
              {info.responses.map((r) => (
                <li key={r.email} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-medium">{r.name || r.email}:</span>
                  {r.answer ? <Badge variant={answerBadge[r.answer]}>{labels[r.answer]}</Badge> : <Badge variant="outline">waiting</Badge>}
                  {r.note && <span className="text-muted-foreground">“{r.note}”</span>}
                  {r.mine && info.open && r.answer && !editing && (
                    <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {info.open && mine && (!mine.answer || editing) && (
              <form
                className="grid gap-4"
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
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">Your answer</legend>
                  <RadioGroup name="answer" defaultValue={mine.answer ?? undefined} required className="flex gap-4">
                    {(Object.keys(labels) as (keyof typeof labels)[]).map((a) => (
                      <Label key={a} className="font-normal">
                        <RadioGroupItem value={a} /> {labels[a]}
                      </Label>
                    ))}
                  </RadioGroup>
                </fieldset>
                <div className="flex gap-2">
                  <Input name="note" aria-label="Note" placeholder="Note" defaultValue={mine.note ?? ''} maxLength={500} />
                  <Button type="submit">Save</Button>
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
        {canAsk && !info?.open && !people && (
          <div>
            <Button variant="outline" onClick={async () => setPeople(await bandOp('listMembers', band, {}))}>
              Check availability
            </Button>
          </div>
        )}
        {people && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => askAvailability({ data: { band, event, emails: [...picked] } }))
            }}
          >
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-sm font-medium">Ask who?</legend>
              <Label className="font-normal">
                <Checkbox
                  checked={picked.size === people.length}
                  onCheckedChange={(c) => setPicked(new Set(c === true ? people.map((p) => p.email) : []))}
                />
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
          </form>
        )}
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  )
}
