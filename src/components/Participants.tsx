import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { answerColor } from '#/components/Availability'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'
import { errorText, useT } from '#/lib/i18n'

type Answer = 'yes' | 'maybe' | 'no'
export type BandPerson = { id: string; name: string; email: string; role: string }
/** A participant's availability: not asked, waiting (asked, no answer) or their answer; stale = asked before the event moved. */
export type ParticipantState = { asked: boolean; answer: Answer | null; stale?: boolean; /** Why maybe */ note?: string | null }

type Props = {
  /** Everyone in the band (who can be picked) */
  people: BandPerson[]
  chosen: Set<string>
  /** Availability per participant (user id); absent = not asked */
  states?: Record<string, ParticipantState>
  /** The check was closed: nobody can answer until it's reopened. */
  closed?: boolean
  canEdit: boolean
  /** Tick or untick people. */
  onChange: (ids: string[], on: boolean) => Promise<void>
  /** Ask every participant not asked yet (starts or reopens the check). */
  onAskAll: () => Promise<void>
  /** Ask just these people: someone added while the check is open, or asked before the event moved. */
  onAsk?: (ids: string[]) => Promise<void>
  onClose?: () => Promise<void>
  onReopen?: () => Promise<void>
}

const answers: Answer[] = ['yes', 'maybe', 'no']
type Count = Answer | 'waiting'
const pillColor: Record<Count, string> = { ...answerColor, waiting: 'bg-muted text-muted-foreground' }

/** One rounded bar with a number per status (yes / maybe / no / waiting), only the nonzero ones. */
export function AvailabilityPill({ counts }: { counts: Record<Count, number> }) {
  const t = useT()
  const shown = ([...answers, 'waiting'] as Count[]).filter((k) => counts[k] > 0)
  if (!shown.length) return null
  return (
    <span
      role="img"
      aria-label={shown.map((k) => `${counts[k]} ${k === 'waiting' ? t.availability.waiting : t.answer[k].toLowerCase()}`).join(', ')}
      className="inline-flex overflow-hidden rounded-full text-xs font-medium tabular-nums"
    >
      {shown.map((k) => (
        <span key={k} className={cn('px-2 py-0.5', pillColor[k])}>
          {counts[k]}
        </span>
      ))}
    </span>
  )
}

/**
 * The Participants field: "3 participants" (with the availability pill once asking started) or "Select".
 * Clicking opens a dialog to add and remove people, ask their availability and close or reopen the check.
 * Readers see it read-only.
 */
export function Participants({ people, chosen, states = {}, closed = false, canEdit, onChange, onAskAll, onAsk, onClose, onReopen }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** People just added while the check is open: offer to ask them too. */
  const [offer, setOffer] = useState<string[]>([])

  const on = people.filter((p) => chosen.has(p.id))
  const state = (id: string): ParticipantState => states[id] ?? { asked: false, answer: null }
  const started = on.some((p) => state(p.id).asked)
  const checkOpen = started && !closed
  const notAsked = on.filter((p) => !state(p.id).asked)
  const counts = {
    ...Object.fromEntries(answers.map((a) => [a, on.filter((p) => state(p.id).answer === a).length])),
    waiting: on.filter((p) => state(p.id).asked && !state(p.id).answer).length,
  } as Record<Count, number>
  const allChosen = people.length > 0 && people.every((p) => chosen.has(p.id))
  // yes > maybe > no > waiting > not asked > not on the event. The sort is stable: names stay alphabetical within each group.
  const rank = (id: string) => {
    const s = state(id)
    return !chosen.has(id) ? 5 : s.answer ? answers.indexOf(s.answer) : s.asked ? 3 : 4
  }
  const shown = canEdit ? people : on
  // The order is taken when the dialog opens, so ticking doesn't move a row; anyone not in it yet goes last.
  const [order, setOrder] = useState<string[]>([])
  const pos = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
  const listed = [...shown].sort((a, b) => pos(a.id) - pos(b.id))

  const run = async (go: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await go()
      setError('')
      return true
    } catch (e) {
      setError(errorText(t, e, t.common.somethingWrong))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function change(ids: string[], add: boolean) {
    const added = ids.filter((id) => !chosen.has(id))
    if (!(await run(() => onChange(ids, add)))) return
    if (!add) setOffer((o) => o.filter((id) => !ids.includes(id)))
    else if (checkOpen && onAsk && added.length) setOffer((o) => [...new Set([...o, ...added])])
  }

  const empty = !on.length
  return (
    <>
      {empty && !canEdit ? (
        <span className="text-muted-foreground">–</span>
      ) : (
        <button
          type="button"
          className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-left font-medium"
          aria-haspopup="dialog"
          onClick={() => {
            setOrder([...shown].sort((a, b) => rank(a.id) - rank(b.id)).map((p) => p.id))
            setOpen(true)
          }}
        >
          <span>{empty ? t.participants.select : t.participants.count(on.length)}</span>
          {started && <AvailabilityPill counts={counts} />}
          <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </button>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setOffer([])
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.participants.title}</DialogTitle>
            <DialogDescription>
              {started ? (closed ? t.participants.checkClosed : t.participants.checkOpen) : canEdit ? t.participants.hint : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50dvh] gap-3 overflow-y-auto py-1">
            {canEdit && (
              <Label className="font-medium">
                <Checkbox checked={allChosen} disabled={busy} onCheckedChange={() => change(people.map((p) => p.id), !allChosen)} />
                {t.participants.selectAll}
              </Label>
            )}
            {listed.map((p) => {
              const s = state(p.id)
              const who = p.name || p.email
              const name = who
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {canEdit ? (
                    <Label className="font-normal">
                      <Checkbox checked={chosen.has(p.id)} disabled={busy} onCheckedChange={(c) => change([p.id], c === true)} />
                      {name}
                    </Label>
                  ) : (
                    <span>{name}</span>
                  )}
                  {chosen.has(p.id) && s.asked && (
                    <Badge className={s.answer ? answerColor[s.answer] : undefined} variant={s.answer ? undefined : 'outline'}>
                      {s.answer ? t.answer[s.answer] : t.availability.waiting}
                    </Badge>
                  )}
                  {chosen.has(p.id) && s.stale && <span className="text-muted-foreground">({t.availability.movedShort})</span>}
                  {chosen.has(p.id) && s.note && <span className="text-muted-foreground">“{s.note}”</span>}
                  {canEdit && checkOpen && onAsk && chosen.has(p.id) && (!s.asked || s.stale) && (
                    <Button variant="ghost" size="xs" className="ml-auto" disabled={busy} aria-label={t.availability.askPerson(who)} onClick={() => run(() => onAsk([p.id]))}>
                      {t.availability.ask}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          {offer.length > 0 && (
            <div role="alert" className="grid gap-2 rounded-md border bg-muted/50 p-3 text-sm">
              <p className="m-0">{t.participants.askAddedToo(offer.length)}</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={async () => (await run(() => onAsk!(offer))) && setOffer([])}>
                  {t.participants.yes}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setOffer([])}>
                  {t.participants.no}
                </Button>
              </div>
            </div>
          )}
          <FormError>{error}</FormError>
          <DialogFooter className="flex-wrap">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.common.done}
            </Button>
            {canEdit && checkOpen && onClose && (
              <Button variant="outline" disabled={busy} onClick={() => run(onClose)}>
                {t.participants.close}
              </Button>
            )}
            {canEdit && started && closed && onReopen && (
              <Button disabled={busy} onClick={() => run(onReopen)}>
                {t.participants.reopen}
              </Button>
            )}
            {canEdit && !(started && closed) && notAsked.length > 0 && (
              <Button disabled={busy} onClick={async () => (await run(onAskAll)) && setOpen(false)}>
                {t.participants.askAvailability}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
