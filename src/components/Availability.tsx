import { useRouter } from '@tanstack/react-router'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { bandOp } from '#/server/fns'
import { errorText, useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'

type Person = Awaited<ReturnType<typeof bandOp<'getAvailability'>>>['people'][number]
type Answer = 'yes' | 'maybe' | 'no'
const answers: Answer[] = ['yes', 'maybe', 'no']
export const answerColor = { yes: 'bg-green-600 text-white', maybe: 'bg-amber-400 text-amber-950', no: 'bg-red-600 text-white' }
const pickerColor = {
  yes: 'data-[state=off]:hover:bg-green-600/10 data-[state=on]:bg-green-600 data-[state=on]:text-white',
  maybe: 'data-[state=off]:hover:bg-amber-400/15 data-[state=on]:bg-amber-400 data-[state=on]:text-amber-950',
  no: 'data-[state=off]:hover:bg-red-600/10 data-[state=on]:bg-red-600 data-[state=on]:text-white',
}

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

/**
 * Your own availability for the event: only while the check is open and you're a participant.
 * Everyone's answers are in the Participants dialog.
 */
export function Availability({ band, event, me, open }: { band: string; event: string; me: Person | undefined; open: boolean }) {
  const t = useT()
  const { run, error } = useRun()
  const [editing, setEditing] = useState(false)
  const online = useOnline()
  const [answer, setAnswer] = useState<Answer | undefined>(me?.answer ?? undefined)

  if (!open || !me) return null
  return (
    <Card aria-labelledby="availability" role="region" className="mt-6">
      <CardHeader>
        <CardTitle id="availability" role="heading" aria-level={2}>
          {t.availability.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {me.stale && (
          <p role="status" className="text-sm text-muted-foreground">
            {t.availability.movedYou}
          </p>
        )}
        {me.answer && !editing && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{t.availability.yourAnswer}:</span>
            <Badge className={answerColor[me.answer]}>{t.answer[me.answer]}</Badge>
            {me.note && <span className="text-muted-foreground">“{me.note}”</span>}
            {online && (
              <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setEditing(true)}>
                {t.common.edit}
              </Button>
            )}
          </p>
        )}
        {/* Offline your answer shows read-only; a form already open stays. */}
        {(editing || (online && !me.answer)) && (
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
              {answer === 'maybe' && <Input className="max-sm:basis-full" name="note" aria-label={t.availability.note} placeholder={t.availability.whyMaybe} defaultValue={me.note ?? ''} maxLength={500} />}
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
