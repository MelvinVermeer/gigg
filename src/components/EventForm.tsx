import { X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '#/components/ui/native-select'
import { Textarea } from '#/components/ui/textarea'
import { withLabels } from '#/lib/labels'
import type { EventFields } from '#/server/ops'

type Venue = { id: string; name: string; address: string | null }
type Contact = { id: string; name: string; email: string | null; phone: string | null }

export type EventFormData = {
  venues: Venue[]
  contacts: Contact[]
  lastContactsByVenue: Record<string, string[]>
  setlists: { id: string; name: string }[]
}

type Initial = Partial<Omit<EventFields, 'venue' | 'contacts'>> & {
  venueId?: string | null
  contacts?: { id: string; name: string }[]
}

type Props = {
  data: EventFormData
  initial?: Initial
  submitLabel: string
  /** New events only: offer to start the setlist from a standalone one. */
  pickSetlist?: boolean
  onSubmit: (fields: EventFields & { setlistFrom?: string | null; setlistStandard?: string | null }) => Promise<void>
}

/** A picked contact: existing (id) or new (typed name plus optional details). */
type Picked = { key: string; id?: string; name: string; email?: string; phone?: string }

const bookingStatuses = ['lead', 'option', 'confirmed', 'played', 'cancelled'] as const
const paymentStatuses = ['open', 'invoiced', 'paid'] as const
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

let nextKey = 0

export function EventForm({ data, initial = {}, submitLabel, pickSetlist = false, onSubmit }: Props) {
  const ids = useId()
  const venues = useMemo(() => withLabels(data.venues, (v) => v.name, (v) => v.address), [data.venues])
  const contacts = useMemo(() => withLabels(data.contacts, (c) => c.name, (c) => c.email ?? c.phone), [data.contacts])
  const contactById = (id: string) => contacts.find((c) => c.id === id)!

  const [venueText, setVenueText] = useState(venues.find((v) => v.id === initial.venueId)?.label ?? '')
  const [venueAddress, setVenueAddress] = useState('')
  const [picked, setPicked] = useState<Picked[]>(() =>
    (initial.contacts ?? []).map((c) => ({ key: c.id, id: c.id, name: contacts.find((x) => x.id === c.id)?.label ?? c.name })),
  )
  const [contactText, setContactText] = useState('')
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
    const setlist = String(f.get('setlist') ?? '')
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        title: String(f.get('title')),
        date: String(f.get('date')),
        venue: venue ? { id: venue.id } : isNewVenue ? { name: venueText.trim(), address: venueAddress } : null,
        contacts: picked.map((c) => (c.id ? { id: c.id } : { name: c.name, email: c.email, phone: c.phone })),
        bookingStatus: f.get('bookingStatus') as EventFields['bookingStatus'],
        paymentStatus: f.get('paymentStatus') as EventFields['paymentStatus'],
        notes: String(f.get('notes')),
        tags: String(f.get('tags'))
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        setlistStandard: setlist.startsWith('standard:') ? setlist.slice(9) : null,
        setlistFrom: setlist.startsWith('custom:') ? setlist.slice(7) : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed')
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <Field label="Title">
        <Input name="title" required maxLength={200} defaultValue={initial.title ?? ''} />
      </Field>
      <Field label="Date">
        <Input name="date" type="date" required defaultValue={initial.date ?? ''} />
      </Field>

      <Field label="Venue">
        <Input
          list={`${ids}-venues`}
          value={venueText}
          onChange={(e) => setVenueText(e.target.value)}
          placeholder="Search or type a new venue"
          autoComplete="off"
        />
      </Field>
      <datalist id={`${ids}-venues`}>
        {venues.map((v) => (
          <option key={v.id} value={v.label} />
        ))}
      </datalist>
      {isNewVenue && (
        <Field label="New venue · address" hint="(optional)" className="border-l-2 pl-4">
          <Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} maxLength={500} />
        </Field>
      )}

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Contacts</legend>
        {suggested.length > 0 && (
          <p className="suggestion flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Last time at {venue!.name}: {suggested.map((id) => contactById(id).label).join(', ')}{' '}
            <Button type="button" size="xs" variant="secondary" onClick={() => suggested.forEach((id) => addContact(contactById(id).label))}>
              Add
            </Button>
          </p>
        )}
        {picked.length > 0 && (
          <ul className="grid gap-2">
            {picked.map((c) => (
              <li key={c.key} className="grid gap-2">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {!c.id && <Badge variant="secondary">new</Badge>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => setPicked((p) => p.filter((x) => x.key !== c.key))}
                  >
                    <X />
                  </Button>
                </span>
                {!c.id && (
                  <span className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label={`Email for ${c.name}`}
                      placeholder="Email (optional)"
                      type="email"
                      value={c.email ?? ''}
                      onChange={(e) => update(c.key, { email: e.target.value })}
                    />
                    <Input
                      aria-label={`Phone for ${c.name}`}
                      placeholder="Phone (optional)"
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
            aria-label="Add contact"
            list={`${ids}-contacts`}
            value={contactText}
            onChange={(e) => setContactText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addContact(contactText)
              }
            }}
            placeholder="Search or type a new contact"
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={() => addContact(contactText)}>
            Add contact
          </Button>
        </span>
        <datalist id={`${ids}-contacts`}>
          {contacts.map((c) => (
            <option key={c.id} value={c.label} />
          ))}
        </datalist>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Booking">
          <NativeSelect name="bookingStatus" defaultValue={initial.bookingStatus ?? 'lead'} className="w-full">
            {bookingStatuses.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {cap(s)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Payment">
          <NativeSelect name="paymentStatus" defaultValue={initial.paymentStatus ?? 'open'} className="w-full">
            {paymentStatuses.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {cap(s)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Notes" hint="(times, load-in, parking, …)">
        <Textarea name="notes" rows={6} maxLength={10_000} defaultValue={initial.notes ?? ''} />
      </Field>
      <Field label="Tags" hint="(comma separated)">
        <Input name="tags" defaultValue={(initial.tags ?? []).join(', ')} />
      </Field>
      {pickSetlist && data.setlists.length > 0 && (
        <Field label="Setlist">
          <NativeSelect name="setlist" defaultValue="" className="w-full">
            <NativeSelectOption value="">Empty</NativeSelectOption>
            <NativeSelectOptGroup label="Standard (use as is)">
              {data.setlists.map((s) => (
                <NativeSelectOption key={s.id} value={`standard:${s.id}`}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
            <NativeSelectOptGroup label="Custom (start as a copy)">
              {data.setlists.map((s) => (
                <NativeSelectOption key={s.id} value={`custom:${s.id}`}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          </NativeSelect>
        </Field>
      )}
      <FormError>{error}</FormError>
      <div>
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
