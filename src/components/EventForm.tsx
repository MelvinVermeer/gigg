import { useId, useMemo, useState } from 'react'
import type { EventFields } from '#/server/ops'

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
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Search-box labels; a detail is added only when names collide, so each label maps to one item. */
function withLabels<T extends { name: string }>(items: T[], detail: (t: T) => string | null) {
  const count = new Map<string, number>()
  for (const i of items) count.set(i.name, (count.get(i.name) ?? 0) + 1)
  return items.map((i) => ({ ...i, label: count.get(i.name)! > 1 && detail(i) ? `${i.name} · ${detail(i)}` : i.name }))
}

let nextKey = 0

export function EventForm({ data, initial = {}, submitLabel, onSubmit }: Props) {
  const ids = useId()
  const venues = useMemo(() => withLabels(data.venues, (v) => v.address), [data.venues])
  const contacts = useMemo(() => withLabels(data.contacts, (c) => c.email ?? c.phone), [data.contacts])
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
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed')
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Title
        <input name="title" required maxLength={200} defaultValue={initial.title ?? ''} />
      </label>
      <label>
        Date
        <input name="date" type="date" required defaultValue={initial.date ?? ''} />
      </label>

      <label>
        Venue
        <input
          list={`${ids}-venues`}
          value={venueText}
          onChange={(e) => setVenueText(e.target.value)}
          placeholder="Search or type a new venue"
          autoComplete="off"
        />
      </label>
      <datalist id={`${ids}-venues`}>
        {venues.map((v) => (
          <option key={v.id} value={v.label} />
        ))}
      </datalist>
      {isNewVenue && (
        <label className="indent">
          New venue · address <small>(optional)</small>
          <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} maxLength={500} />
        </label>
      )}

      <fieldset className="stack">
        <legend>Contacts</legend>
        {suggested.length > 0 && (
          <p className="suggestion">
            Last time at {venue!.name}: {suggested.map((id) => contactById(id).label).join(', ')}{' '}
            <button type="button" onClick={() => suggested.forEach((id) => addContact(contactById(id).label))}>
              Add
            </button>
          </p>
        )}
        {picked.length > 0 && (
          <ul className="picked">
            {picked.map((c) => (
              <li key={c.key}>
                <span>
                  {c.name} {!c.id && <small>(new)</small>}
                </span>
                <button type="button" aria-label={`Remove ${c.name}`} onClick={() => setPicked((p) => p.filter((x) => x.key !== c.key))}>
                  ×
                </button>
                {!c.id && (
                  <span className="row">
                    <input
                      aria-label={`Email for ${c.name}`}
                      placeholder="Email (optional)"
                      type="email"
                      value={c.email ?? ''}
                      onChange={(e) => update(c.key, { email: e.target.value })}
                    />
                    <input
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
        <span className="row">
          <input
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
          <button type="button" onClick={() => addContact(contactText)}>
            Add contact
          </button>
        </span>
        <datalist id={`${ids}-contacts`}>
          {contacts.map((c) => (
            <option key={c.id} value={c.label} />
          ))}
        </datalist>
      </fieldset>

      <div className="row">
        <label>
          Booking
          <select name="bookingStatus" defaultValue={initial.bookingStatus ?? 'lead'}>
            {bookingStatuses.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment
          <select name="paymentStatus" defaultValue={initial.paymentStatus ?? 'open'}>
            {paymentStatuses.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes <small>(times, load-in, parking, …)</small>
        <textarea name="notes" rows={6} maxLength={10_000} defaultValue={initial.notes ?? ''} />
      </label>
      <label>
        Tags <small>(comma separated)</small>
        <input name="tags" defaultValue={(initial.tags ?? []).join(', ')} />
      </label>
      {error && <p role="alert">{error}</p>}
      <p>
        <button type="submit" disabled={busy}>
          {submitLabel}
        </button>
      </p>
    </form>
  )
}
