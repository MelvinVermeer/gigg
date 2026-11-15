import { Plus, X } from 'lucide-react'
import { Link, useParams } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { Combobox } from '#/components/Combobox'
import { Participants } from '#/components/Participants'
import { Field, FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Textarea } from '#/components/ui/textarea'
import { withLabels } from '#/lib/labels'
import type { EventFields } from '#/server/ops'
import { askAvailability } from '#/server/fns'
import { errorText, useT } from '#/lib/i18n'

type Venue = { id: string; name: string; address: string | null }
type Contact = { id: string; name: string; email: string | null; phone: string | null }

export type EventFormData = {
  venues: Venue[]
  contacts: Contact[]
  lastContactsByVenue: Record<string, string[]>
  /** Non-cancelled, non-archived events, for the same-date warning */
  events: { slug: string; title: string; date: string; bookingStatus: NonNullable<EventFields['bookingStatus']> }[]
  /** Band members and readers, to put on the event */
  people: { id: string; name: string; email: string; role: string }[]
}

type Initial = Partial<Omit<EventFields, 'venue' | 'contacts' | 'people'>> & {
  /** In edit: the event itself, left out of the same-date warning */
  slug?: string
  venueId?: string | null
  contacts?: { id: string; name: string }[]
}

type Props = {
  data: EventFormData
  initial?: Initial
  submitLabel: string
  /** Lets a submit button outside the form (form={id}) save it too */
  id?: string
  /** Show the Participants field (creating only: an existing event manages them on its page). */
  withParticipants?: boolean
  /** Save the event; returns its slug. */
  onSubmit: (fields: EventFields) => Promise<string>
  /** After saving (and asking availability, if wanted). */
  onSaved: (slug: string) => Promise<unknown>
}


/** A picked contact: existing (id) or new (typed name plus optional details). */
type Picked = { key: string; id?: string; name: string; email?: string; phone?: string }

const bookingStatuses = ['lead', 'option', 'confirmed', 'cancelled'] as const
const paymentStatuses = ['open', 'invoiced', 'paid', 'free'] as const

let nextKey = 0

const matches = (label: string, text: string) => label.toLowerCase().includes(text.trim().toLowerCase())

export function EventForm({ data, initial = {}, submitLabel, id, withParticipants, onSubmit, onSaved }: Props) {
  const t = useT()
  const { band } = useParams({ strict: false }) as { band: string }
  const venues = useMemo(() => withLabels(data.venues, (v) => v.name, (v) => v.address), [data.venues])
  const contacts = useMemo(() => withLabels(data.contacts, (c) => c.name, (c) => c.email ?? c.phone), [data.contacts])
  const contactById = (id: string) => contacts.find((c) => c.id === id)!

  const [venueText, setVenueText] = useState(venues.find((v) => v.id === initial.venueId)?.label ?? '')
  const [venueAddress, setVenueAddress] = useState('')
  const [picked, setPicked] = useState<Picked[]>(() =>
    (initial.contacts ?? []).map((c) => ({ key: c.id, id: c.id, name: contacts.find((x) => x.id === c.id)?.label ?? c.name })),
  )
  const [contactText, setContactText] = useState('')
  const [date, setDate] = useState(initial.date ?? '')
  const sameDate = data.events.filter((e) => e.date === date && e.slug !== initial.slug)
  const [startTime, setStartTime] = useState(initial.startTime?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(initial.endTime?.slice(0, 5) ?? '')
  const [people, setPeople] = useState(() => new Set<string>())
  const form = useRef<HTMLFormElement>(null)
  const askButton = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const venue = venues.find((v) => v.label === venueText.trim())
  const isNewVenue = !venue && venueText.trim() !== ''
  const suggested = (venue ? (data.lastContactsByVenue[venue.id] ?? []) : []).filter(
    (id) => !picked.some((p) => p.id === id),
  )

  function addContact(c: (typeof contacts)[number]) {
    setPicked((p) => (p.some((x) => x.id === c.id) ? p : [...p, { key: c.id, id: c.id, name: c.label }]))
    setContactText('')
  }

  function addNewContact(text: string) {
    setPicked((p) => [...p, { key: `new${nextKey++}`, name: text.trim() }])
    setContactText('')
  }

  const update = (key: string, patch: Partial<Picked>) =>
    setPicked((p) => p.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    // "Ask availability" (participants dialog) saves the form, then asks every participant.
    const askAll = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'ask'
    setBusy(true)
    setError('')
    let slug: string
    try {
      slug = await onSubmit({
        title: String(f.get('title')),
        date: String(f.get('date')),
        startTime,
        endTime,
        venue: venue ? { id: venue.id } : isNewVenue ? { name: venueText.trim(), address: venueAddress } : null,
        contacts: picked.map((c) => (c.id ? { id: c.id } : { name: c.name, email: c.email, phone: c.phone })),
        people: withParticipants ? [...people] : undefined,
        bookingStatus: f.get('bookingStatus') as EventFields['bookingStatus'],
        paymentStatus: f.get('paymentStatus') as EventFields['paymentStatus'],
        fee: String(f.get('fee')),
        notes: String(f.get('notes')),
        tags: String(f.get('tags'))
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
    } catch (err) {
      setError(errorText(t, err, t.common.savingFailed))
      setBusy(false)
      return
    }
    if (askAll)
      try {
        await askAvailability({ data: { band, event: slug } })
      } catch {
        // The event is saved; the event page shows who wasn't asked, with Ask next to them.
      }
    await onSaved(slug)
  }

  return (
    <form ref={form} id={id} className="grid gap-5" onSubmit={submit}>
      <Field label={t.common.title}>
        <Input name="title" required maxLength={200} defaultValue={initial.title ?? ''} />
      </Field>
      <Field label={t.common.date}>
        <Input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {sameDate.length > 0 && (
        <p role="status" className="-mt-3 text-sm text-amber-700 dark:text-amber-400">
          {t.eventForm.sameDate}{' '}
          {sameDate.map((e, i) => (
            <span key={e.slug}>
              {i > 0 && ', '}
              <Link to="/$band/events/$event" params={{ band, event: e.slug }} className="underline">
                {e.title}
              </Link>{' '}
              ({t.booking[e.bookingStatus].toLowerCase()})
            </span>
          ))}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.eventForm.start} hint={t.common.optional}>
          <Input name="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required={!!endTime} />
        </Field>
        <Field label={t.eventForm.end} hint={startTime && endTime && endTime < startTime ? t.eventForm.nextDay : t.common.optional}>
          <Input name="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>

      {/* Not a Field: the combobox names its own input (cmdk sets the id). */}
      <div className="grid gap-2">
        <Label>{t.common.venue}</Label>
        <Combobox
          label={t.common.venue}
          value={venueText}
          onValueChange={setVenueText}
          placeholder={t.eventForm.venuePlaceholder}
          options={[
            ...venues.filter((v) => matches(v.label, venueText)).map((v) => ({ value: v.id, label: v.label, onSelect: () => setVenueText(v.label) })),
            ...(venue || !venueText.trim() ? [] : [{ value: '+', label: <><Plus aria-hidden /> {t.eventForm.newVenue(venueText.trim())}</>, onSelect: () => {} }]),
          ]}
        />
      </div>
      {isNewVenue && (
        <Field label={t.eventForm.newVenueAddress} hint={t.common.optional} className="border-l-2 pl-4">
          <Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} maxLength={500} />
        </Field>
      )}

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">{t.common.contacts}</legend>
        {suggested.length > 0 && (
          <p className="suggestion flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t.eventForm.lastTimeAt(venue!.name, suggested.map((id) => contactById(id).label).join(', '))}{' '}
            <Button type="button" size="xs" variant="secondary" onClick={() => suggested.forEach((id) => addContact(contactById(id)))}>
              {t.common.add}
            </Button>
          </p>
        )}
        {picked.length > 0 && (
          <ul className="grid gap-2">
            {picked.map((c) => (
              <li key={c.key} className="grid gap-2">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {!c.id && <Badge variant="secondary">{t.eventForm.new}</Badge>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    aria-label={t.eventForm.removeContact(c.name)}
                    onClick={() => setPicked((p) => p.filter((x) => x.key !== c.key))}
                  >
                    <X />
                  </Button>
                </span>
                {!c.id && (
                  <span className="grid gap-2 sm:grid-cols-2">
                    <Input
                      aria-label={t.eventForm.phoneFor(c.name)}
                      placeholder={t.eventForm.phoneOptional}
                      type="tel"
                      value={c.phone ?? ''}
                      onChange={(e) => update(c.key, { phone: e.target.value })}
                    />
                    <Input
                      aria-label={t.eventForm.emailFor(c.name)}
                      placeholder={t.eventForm.emailOptional}
                      type="email"
                      value={c.email ?? ''}
                      onChange={(e) => update(c.key, { email: e.target.value })}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <Combobox
          label={t.eventForm.addContact}
          value={contactText}
          onValueChange={setContactText}
          placeholder={t.eventForm.contactPlaceholder}
          options={[
            ...contacts
              .filter((c) => !picked.some((p) => p.id === c.id) && matches(c.label, contactText))
              .map((c) => ({ value: c.id, label: c.label, onSelect: () => addContact(c) })),
            ...(contacts.some((c) => c.label.toLowerCase() === contactText.trim().toLowerCase())
              ? []
              : [{ value: '+', label: <><Plus aria-hidden /> {t.eventForm.newContact(contactText.trim())}</>, onSelect: () => addNewContact(contactText) }]),
          ]}
        />
      </fieldset>

      {withParticipants && (
        <div className="grid gap-2">
          <Label>{t.participants.title}</Label>
          <div>
            <Participants
              people={data.people}
              chosen={people}
              canEdit
              onChange={async (ids, on) =>
                setPeople((s) => new Set(on ? [...s, ...ids] : [...s].filter((id) => !ids.includes(id))))
              }
              // Submit once the dialog has closed, so the browser can point at a missing title or date.
              onAskAll={async () => void setTimeout(() => form.current?.requestSubmit(askButton.current))}
            />
          </div>
          <button ref={askButton} type="submit" name="ask" hidden />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={t.events.booking}>
          <NativeSelect name="bookingStatus" defaultValue={initial.bookingStatus ?? 'lead'} className="w-full">
            {bookingStatuses.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {t.booking[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t.events.payment}>
          <NativeSelect name="paymentStatus" defaultValue={initial.paymentStatus ?? 'open'} className="w-full">
            {paymentStatuses.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {t.payment[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t.events.fee} hint={t.common.optional}>
        <Input name="fee" maxLength={200} placeholder={t.eventForm.feePlaceholder} defaultValue={initial.fee ?? ''} />
      </Field>
      <Field label={t.common.notes} hint={t.eventForm.notesHint}>
        <Textarea name="notes" rows={6} maxLength={10_000} defaultValue={initial.notes ?? ''} />
      </Field>
      <Field label={t.common.tags} hint={t.common.commaSeparated}>
        <Input name="tags" defaultValue={(initial.tags ?? []).join(', ')} />
      </Field>
      <FormError>{error}</FormError>
      <div>
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

