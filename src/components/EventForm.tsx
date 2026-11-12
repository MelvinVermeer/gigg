import { X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Textarea } from '#/components/ui/textarea'
import { withLabels } from '#/lib/labels'
import type { EventFields } from '#/server/ops'
import { errorText, useT } from '#/lib/i18n'

type Venue = { id: string; name: string; address: string | null }
type Contact = { id: string; name: string; email: string | null; phone: string | null }

export type EventFormData = {
  venues: Venue[]
  contacts: Contact[]
  lastContactsByVenue: Record<string, string[]>
}

type Initial = Partial<Omit<EventFields, 'venue' | 'contacts'>> & {
  venueId?: string | null
  contacts?: { id: string; name: string }[]
}

type Props = {
  data: EventFormData
  initial?: Initial
  submitLabel: string
  onSubmit: (fields: EventFields) => Promise<void>
}

/** A picked contact: existing (id) or new (typed name plus optional details). */
type Picked = { key: string; id?: string; name: string; email?: string; phone?: string }

const bookingStatuses = ['lead', 'option', 'confirmed', 'played', 'cancelled'] as const
const paymentStatuses = ['open', 'invoiced', 'paid'] as const

let nextKey = 0

export function EventForm({ data, initial = {}, submitLabel, onSubmit }: Props) {
  const ids = useId()
  const t = useT()
  const venues = useMemo(() => withLabels(data.venues, (v) => v.name, (v) => v.address), [data.venues])
  const contacts = useMemo(() => withLabels(data.contacts, (c) => c.name, (c) => c.email ?? c.phone), [data.contacts])
  const contactById = (id: string) => contacts.find((c) => c.id === id)!

  const [venueText, setVenueText] = useState(venues.find((v) => v.id === initial.venueId)?.label ?? '')
  const [venueAddress, setVenueAddress] = useState('')
  const [picked, setPicked] = useState<Picked[]>(() =>
    (initial.contacts ?? []).map((c) => ({ key: c.id, id: c.id, name: contacts.find((x) => x.id === c.id)?.label ?? c.name })),
  )
  const [contactText, setContactText] = useState('')
  const [startTime, setStartTime] = useState(initial.startTime?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(initial.endTime?.slice(0, 5) ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const venue = venues.find((v) => v.label === venueText.trim())
  const isNewVenue = !venue && venueText.trim() !== ''
  const suggested = (venue ? (data.lastContactsByVenue[venue.id] ?? []) : []).filter(
    (id) => !picked.some((p) => p.id === id),
  )

  function addContact(text: string) {
    const name = text.trim()
    if (!name) return
    const existing = contacts.find((c) => c.label === name)
    if (existing && picked.some((p) => p.id === existing.id)) return setContactText('')
    setPicked((p) => [...p, existing ? { key: existing.id, id: existing.id, name } : { key: `new${nextKey++}`, name }])
    setContactText('')
  }

  const update = (key: string, patch: Partial<Picked>) =>
    setPicked((p) => p.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        title: String(f.get('title')),
        date: String(f.get('date')),
        startTime,
        endTime,
        venue: venue ? { id: venue.id } : isNewVenue ? { name: venueText.trim(), address: venueAddress } : null,
        contacts: picked.map((c) => (c.id ? { id: c.id } : { name: c.name, email: c.email, phone: c.phone })),
        bookingStatus: f.get('bookingStatus') as EventFields['bookingStatus'],
        paymentStatus: f.get('paymentStatus') as EventFields['paymentStatus'],
        notes: String(f.get('notes')),
        tags: String(f.get('tags'))
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
    } catch (err) {
      setError(errorText(t, err, t.common.savingFailed))
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <Field label={t.common.title}>
        <Input name="title" required maxLength={200} defaultValue={initial.title ?? ''} />
      </Field>
      <Field label={t.common.date}>
        <Input name="date" type="date" required defaultValue={initial.date ?? ''} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.eventForm.start} hint={t.common.optional}>
          <Input name="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required={!!endTime} />
        </Field>
        <Field label={t.eventForm.end} hint={startTime && endTime && endTime < startTime ? t.eventForm.nextDay : t.common.optional}>
          <Input name="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>

      <Field label={t.common.venue}>
        <Input
          list={`${ids}-venues`}
          value={venueText}
          onChange={(e) => setVenueText(e.target.value)}
          placeholder={t.eventForm.venuePlaceholder}
          autoComplete="off"
        />
      </Field>
      <datalist id={`${ids}-venues`}>
        {venues.map((v) => (
          <option key={v.id} value={v.label} />
        ))}
      </datalist>
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
            <Button type="button" size="xs" variant="secondary" onClick={() => suggested.forEach((id) => addContact(contactById(id).label))}>
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
                  <span className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label={t.eventForm.emailFor(c.name)}
                      placeholder={t.eventForm.emailOptional}
                      type="email"
                      value={c.email ?? ''}
                      onChange={(e) => update(c.key, { email: e.target.value })}
                    />
                    <Input
                      aria-label={t.eventForm.phoneFor(c.name)}
                      placeholder={t.eventForm.phoneOptional}
                      type="tel"
                      value={c.phone ?? ''}
                      onChange={(e) => update(c.key, { phone: e.target.value })}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <span className="flex gap-2">
          <Input
            aria-label={t.eventForm.addContact}
            list={`${ids}-contacts`}
            value={contactText}
            onChange={(e) => setContactText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addContact(contactText)
              }
            }}
            placeholder={t.eventForm.contactPlaceholder}
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={() => addContact(contactText)}>
            {t.eventForm.addContact}
          </Button>
        </span>
        <datalist id={`${ids}-contacts`}>
          {contacts.map((c) => (
            <option key={c.id} value={c.label} />
          ))}
        </datalist>
      </fieldset>

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
