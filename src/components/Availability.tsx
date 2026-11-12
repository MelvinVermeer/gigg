import { useRouter } from '@tanstack/react-router'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { formatDate } from '#/lib/date'
import { askAvailability, bandOp } from '#/server/fns'
import { errorText, label as labelOf, useT } from '#/lib/i18n'
import type { Dict } from '#/lib/i18n'

type Info = NonNullable<Awaited<ReturnType<typeof bandOp<'getAvailability'>>>>
type Answer = 'yes' | 'maybe' | 'no'
const answers: Answer[] = ['yes', 'maybe', 'no']
const answerBadge = { yes: 'default', maybe: 'secondary', no: 'destructive' } as const

/** Yes / Maybe / No as one segmented button group (radios to assistive tech). */
export function AnswerPicker({ value, onChange }: { value: Answer | undefined; onChange: (a: Answer) => void }) {
  const t = useT()
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={t.availability.yourAnswer}
      value={value ?? ''}
      onValueChange={(v) => v && onChange(v as Answer)}
      className="inline-flex w-fit overflow-hidden rounded-md border shadow-xs"
    >
      {answers.map((a) => (
        <ToggleGroup.Item
          key={a}
          value={a}
          className="h-9 border-l px-5 text-sm font-medium outline-none first:border-l-0 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {t.answer[a]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/** "all 5 yes", or "5 yes / 2 no / 1 maybe / 1 waiting" (zero counts left out). */
export function summarize(t: Dict, responses: { answer: Answer | null }[]) {
  const n = (a: Answer | null) => responses.filter((r) => r.answer === a).length
  const w = t.availability.count
  if (n('yes') === responses.length) return t.availability.allYes(responses.length)
  return (
    [
      [n('yes'), w.yes],
      [n('no'), w.no],
      [n('maybe'), w.maybe],
      [n(null), w.waiting],
    ] as const
  )
    .filter(([c]) => c)
    .map(([c, w]) => `${c} ${w}`)
    .join(' / ')
}

/** Run a change, then reload the page data; returns the error message, if any. */
function useRun() {
  const router = useRouter()
  const t = useT()
  const [error, setError] = useState('')
  const run = async (go: () => Promise<unknown>) => {
    try {
      await go()
      setError('')
      await router.invalidate()
      return true
    } catch (e) {
      setError(errorText(t, e, t.common.somethingWrong))
      return false
    }
  }
  return { run, error }
}

function Responses({ info, onEdit }: { info: Info; onEdit?: () => void }) {
  const t = useT()
  return (
    <ul className="divide-y">
      {info.responses.map((r) => (
        <li key={r.email} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="font-medium">{r.name || r.email}:</span>
          {r.answer ? <Badge variant={answerBadge[r.answer]}>{t.answer[r.answer]}</Badge> : <Badge variant="outline">{t.availability.waiting}</Badge>}
          {r.note && <span className="text-muted-foreground">“{r.note}”</span>}
          {r.mine && r.answer && onEdit && (
            <Button variant="ghost" size="xs" className="ml-auto" onClick={onEdit}>
              {t.common.edit}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Pick people and send them the question. Nobody is preselected. */
function Ask({ band, event, label }: { band: string; event: string; label?: string }) {
  const t = useT()
  const { run, error } = useRun()
  const [people, setPeople] = useState<{ email: string; name: string; role: string }[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  if (!people)
    return (
      <div>
        <Button variant="outline" onClick={async () => setPeople(await bandOp('listMembers', band, {}))}>
          {label ?? t.availability.check}
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
        <legend className="mb-2 text-sm font-medium">{t.availability.askWho}</legend>
        <Label className="font-normal">
          <Checkbox checked={picked.size === people.length} onCheckedChange={(c) => setPicked(new Set(c === true ? people.map((p) => p.email) : []))} />
          {t.availability.selectAll}
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
            {p.name || p.email} <span className="text-muted-foreground">({labelOf(t.role, p.role)})</span>
          </Label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={!picked.size}>
          {t.availability.send}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPeople(null)}>
          {t.common.cancel}
        </Button>
      </div>
      <FormError>{error}</FormError>
    </form>
  )
}

/** "Can you make it?" while asking (or before anyone was asked). A closed check shows as <AvailabilitySummary>. */
export function Availability({ band, event, info, canAsk }: { band: string; event: string; info: Info | null; canAsk: boolean }) {
  const t = useT()
  const { run, error } = useRun()
  const [editing, setEditing] = useState(false)
  const mine = info?.responses.find((r) => r.mine)
  const [answer, setAnswer] = useState<Answer | undefined>(mine?.answer ?? undefined)

  if (info ? !info.open : !canAsk) return null
  return (
    <Card aria-labelledby="availability" role="region" className="mt-6">
      <CardHeader>
        <CardTitle id="availability" role="heading" aria-level={2}>
          {t.availability.title}
        </CardTitle>
        {info && (
          <CardDescription>
            {t.availability.asking(formatDate(info.date, t.intl), summarize(t, info.responses))}
          </CardDescription>
        )}
        {info && canAsk && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => run(() => bandOp('closeAvailability', band, { event }))}>
              {t.availability.close}
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
                {t.availability.moved}
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
                  <legend className="mb-2 text-sm font-medium">{t.availability.yourAnswer}</legend>
                  <AnswerPicker value={answer} onChange={setAnswer} />
                </fieldset>
                <div className="flex gap-2">
                  {answer === 'maybe' && <Input name="note" aria-label={t.availability.note} placeholder={t.availability.whyMaybe} defaultValue={mine.note ?? ''} maxLength={500} />}
                  <Button type="submit" disabled={!answer}>
                    {t.common.save}
                  </Button>
                  {editing && (
                    <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                      {t.common.cancel}
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
  const t = useT()
  const { run, error } = useRun()
  return (
    <div>
      <Button variant="outline" onClick={() => run(() => bandOp('reopenAvailability', band, { event }))}>
        {t.availability.reopen}
      </Button>
      <FormError>{error}</FormError>
    </div>
  )
}

/** The closed check as a row in the event's field list; clicking opens everyone's answers. */
export function AvailabilitySummary({ band, event, info, canAsk }: { band: string; event: string; info: Info | null; canAsk: boolean }) {
  const t = useT()
  if (!info || info.open) return null
  return (
    <>
      <dt className="text-muted-foreground">{t.availability.title}</dt>
      <dd>
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="text-left font-medium underline-offset-4 hover:underline">
              {summarize(t, info.responses)}
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.availability.title}</DialogTitle>
              <DialogDescription>
                {t.availability.askedFor(formatDate(info.date, t.intl))}
                {info.stale && t.availability.movedSince}
              </DialogDescription>
            </DialogHeader>
            <Responses info={info} />
            {canAsk && <Reopen band={band} event={event} />}
            {canAsk && <Ask band={band} event={event} label={t.availability.newCheck} />}
          </DialogContent>
        </Dialog>
      </dd>
    </>
  )
}
