import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { answerColor } from '#/components/Availability'
import { FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { errorText, label, useT } from '#/lib/i18n'

type Answer = 'yes' | 'maybe' | 'no'
export type BandPerson = { id: string; name: string; email: string; role: string }
/** A participant's availability: not asked, waiting (asked, no answer) or their answer. */
export type ParticipantState = { asked: boolean; answer: Answer | null }

type Props = {
  /** Everyone in the band (who can be picked) */
  people: BandPerson[]
  chosen: Set<string>
  /** Availability per participant (user id); absent = not asked */
  states?: Record<string, ParticipantState>
  canEdit: boolean
  /** Tick or untick people. */
  onChange: (ids: string[], on: boolean) => Promise<void>
  /** Ask every participant not asked yet. */
  onAskAll: () => Promise<void>
  /** Ask just these people (offered when adding someone after asking started). */
  onAsk?: (ids: string[]) => Promise<void>
}

const answers: Answer[] = ['yes', 'maybe', 'no']

/**
 * The Participants field: "3 participants" (with answer counts once asking started) or "Select".
 * Clicking opens a dialog to add and remove people and ask their availability. Readers see it read-only.
 */
export function Participants({ people, chosen, states = {}, canEdit, onChange, onAskAll, onAsk }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** People just added after asking started: offer to ask them too. */
  const [offer, setOffer] = useState<string[]>([])

  const on = people.filter((p) => chosen.has(p.id))
  const state = (id: string): ParticipantState => states[id] ?? { asked: false, answer: null }
  const askedAny = on.some((p) => state(p.id).asked)
  const notAsked = on.filter((p) => !state(p.id).asked)
  const counts = {
    ...Object.fromEntries(answers.map((a) => [a, on.filter((p) => state(p.id).answer === a).length])),
    waiting: on.filter((p) => state(p.id).asked && !state(p.id).answer).length,
  } as Record<Answer | 'waiting', number>
  const allChosen = people.length > 0 && people.every((p) => chosen.has(p.id))
  const listed = canEdit ? people : on

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
    else if (askedAny && onAsk && added.length) setOffer((o) => [...new Set([...o, ...added])])
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
          onClick={() => setOpen(true)}
        >
          <span>{empty ? t.participants.select : t.participants.count(on.length)}</span>
          {askedAny && (
            <span className="inline-flex flex-wrap gap-1">
              {answers.map(
                (a) =>
                  counts[a] > 0 && (
                    <Badge key={a} className={answerColor[a]}>
                      {counts[a]} {t.answer[a].toLowerCase()}
                    </Badge>
                  ),
              )}
              {counts.waiting > 0 && (
                <Badge variant="outline">
                  {counts.waiting} {t.availability.waiting}
                </Badge>
              )}
            </span>
          )}
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
            {canEdit && <DialogDescription>{t.participants.hint}</DialogDescription>}
          </DialogHeader>
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto py-1">
            {canEdit && (
              <Label className="font-medium">
                <Checkbox checked={allChosen} disabled={busy} onCheckedChange={() => change(people.map((p) => p.id), !allChosen)} />
                {t.participants.selectAll}
              </Label>
            )}
            {listed.map((p) => {
              const s = state(p.id)
              const name = (
                <>
                  {p.name || p.email} <span className="text-muted-foreground">({label(t.role, p.role)})</span>
                </>
              )
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.common.done}
            </Button>
            {canEdit && notAsked.length > 0 && (
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
