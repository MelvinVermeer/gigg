// Venues and contacts: the settings list, the linked events on their page, and the edit form.
import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import { formatDate } from '#/lib/date'
import { errorText, useT } from '#/lib/i18n'

type Item = { id: string; archivedAt: Date | null; events: number }

/** One row per record: its name (a link to its page), then a detail line and how many events use it. */
export function RecordList<T extends Item>({ items, name, detail }: { items: T[]; name: (item: T) => ReactNode; detail: (item: T) => ReactNode }) {
  const t = useT()
  if (!items.length) return <p className="text-muted-foreground">{t.common.nothingHere}</p>
  return (
    <ul className="records divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id} className={cn('grid gap-0.5 px-4 py-3', item.archivedAt && 'opacity-60')}>
          <span className="font-medium">{name(item)}</span>
          <span className="text-sm text-muted-foreground">
            {[detail(item), t.records.usedIn(item.events)]
              .filter(Boolean)
              .map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && ' · '}
                  {part}
                </Fragment>
              ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

type LinkedEvent = { slug: string; title: string; date: string; archivedAt: Date | null }

/** The events a venue or contact is linked to, newest first. */
export function LinkedEvents({ band, events }: { band: string; events: LinkedEvent[] }) {
  const t = useT()
  return (
    <section className="mt-8">
      <h2>{t.common.events}</h2>
      {events.length ? (
        <ul className="linked-events divide-y rounded-xl border bg-card">
          {events.map((e) => (
            <li key={e.slug} className={cn('px-4 py-2.5 text-sm', e.archivedAt && 'opacity-60')}>
              <Link to="/$band/events/$event" params={{ band, event: e.slug }} className="font-medium hover:underline">
                {e.title}
              </Link>
              <span className="text-muted-foreground"> · {formatDate(e.date, t.intl)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t.records.noEvents}</p>
      )}
    </section>
  )
}

export type RecordField = {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'textarea'
  required?: boolean
  max: number
}

/** The edit form of a venue or contact. */
export function RecordForm({
  fields,
  initial,
  onSubmit,
}: {
  fields: RecordField[]
  initial: Record<string, unknown>
  onSubmit: (values: Record<string, string>) => Promise<void>
}) {
  const t = useT()
  const [error, setError] = useState<string>()

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    try {
      await onSubmit(Object.fromEntries(fields.map((f) => [f.name, String(data.get(f.name) ?? '')])))
    } catch (err) {
      setError(errorText(t, err, t.common.savingFailed))
    }
  }

  return (
    <form id="record-form" className="grid gap-4" onSubmit={save}>
      {fields.map((f) => {
        const value = String(initial[f.name] ?? '')
        return (
          <Field key={f.name} label={f.label}>
            {f.type === 'textarea' ? (
              <Textarea name={f.name} rows={5} maxLength={f.max} defaultValue={value} />
            ) : (
              <Input name={f.name} type={f.type ?? 'text'} required={f.required} maxLength={f.max} defaultValue={value} />
            )}
          </Field>
        )
      })}
      {error && <FormError>{error}</FormError>}
      <div>
        <Button type="submit">{t.common.save}</Button>
      </div>
    </form>
  )
}
