import { useRouter } from '@tanstack/react-router'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { askAvailability, bandOp } from '#/server/fns'
import { errorText, useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'

type Person = Awaited<ReturnType<typeof bandOp<'getAvailability'>>>[number]
type Answer = 'yes' | 'maybe' | 'no'
const answers: Answer[] = ['yes', 'maybe', 'no']
const answerColor = { yes: 'bg-green-600 text-white', maybe: 'bg-amber-400 text-amber-950', no: 'bg-red-600 text-white' }
const pickerColor = {
  yes: 'data-[state=off]:hover:bg-green-600/10 data-[state=on]:bg-green-600 data-[state=on]:text-white',
  maybe: 'data-[state=off]:hover:bg-amber-400/15 data-[state=on]:bg-amber-400 data-[state=on]:text-amber-950',
  no: 'data-[state=off]:hover:bg-red-600/10 data-[state=on]:bg-red-600 data-[state=on]:text-white',
}
/** yes > maybe > no > waiting > not asked */
const rank = (p: Person) => (p.answer ? answers.indexOf(p.answer) : p.asked ? 3 : 4)

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
          className={cn('h-9 border-l px-5 text-sm font-medium outline-none first:border-l-0 focus-visible:ring-[3px] focus-visible:ring-ring/50', pickerColor[a])}
        >
          {t.answer[a]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
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

/** The event's people with their availability. Members ask everyone not asked yet, or one person at a time. */
export function Availability({ band, event, people, canAsk }: { band: string; event: string; people: Person[]; canAsk: boolean }) {
  const t = useT()
  const { run, error } = useRun()
  const [editing, setEditing] = useState(false)
  const online = useOnline()
  const mine = people.find((p) => p.mine)
  const [answer, setAnswer] = useState<Answer | undefined>(mine?.answer ?? undefined)
  const ask = (user?: string) => run(() => askAvailability({ data: { band, event, user } }))

  if (!people.length && !canAsk) return null
  return (
    <Card aria-labelledby="availability" role="region" className="mt-6">
      <CardHeader>
        <CardTitle id="availability" role="heading" aria-level={2}>
          {t.availability.title}
        </CardTitle>
        {canAsk && people.some((p) => !p.asked) && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => ask()}>
              {t.availability.check}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {!people.length && <p className="text-sm text-muted-foreground">{t.availability.noPeople}</p>}
        {people.some((p) => p.stale) && (
          <p role="status" className="text-sm text-muted-foreground">
            {t.availability.moved}
          </p>
        )}
        {people.length > 0 && (
          <ul className="divide-y">
            {[...people].sort((a, b) => rank(a) - rank(b)).map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium">{p.name || p.email}:</span>
                {p.answer ? (
                  <Badge className={answerColor[p.answer]}>{t.answer[p.answer]}</Badge>
                ) : (
                  <Badge variant="outline" className={p.asked ? undefined : 'text-muted-foreground'}>
                    {p.asked ? t.availability.waiting : t.availability.notAsked}
                  </Badge>
                )}
                {p.stale && <span className="text-muted-foreground">({t.availability.movedShort})</span>}
                {p.note && <span className="text-muted-foreground">“{p.note}”</span>}
                {p.mine && p.answer && !editing && online && (
                  <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setEditing(true)}>
                    {t.common.edit}
                  </Button>
                )}
                {canAsk && (!p.asked || p.stale) && (
                  <Button variant="ghost" size="xs" className="ml-auto" aria-label={t.availability.askPerson(p.name || p.email)} onClick={() => ask(p.userId)}>
                    {t.availability.ask}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {/* Offline your answer shows read-only; a form already open stays. */}
        {mine && (editing || (online && !mine.answer)) && (
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
            <div className="flex gap-2 max-sm:flex-wrap">
              {answer === 'maybe' && <Input className="max-sm:basis-full" name="note" aria-label={t.availability.note} placeholder={t.availability.whyMaybe} defaultValue={mine.note ?? ''} maxLength={500} />}
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
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  )
}
