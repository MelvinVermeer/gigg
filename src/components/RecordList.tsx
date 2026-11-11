import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Field, FormError } from '#/components/Field'
import { HistoryLink } from '#/components/HistoryLink'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'

export type Field = {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'textarea'
  required?: boolean
  max: number
}

type Item = { id: string; name: string; archivedAt: Date | null; events: number }

type Props<T extends Item> = {
  items: T[]
  fields: Field[]
  /** Second line under the name, e.g. the address. */
  detail: (item: T) => string | null
  canEdit: boolean
  onSave: (id: string, values: Record<string, string>) => Promise<void>
  onArchive: (id: string, archived: boolean) => Promise<void>
}

/** A list where each row folds open into an edit form. Used for venues and contacts. */
export function RecordList<T extends Item>({ items, fields, detail, canEdit, onSave, onArchive }: Props<T>) {
  const [error, setError] = useState<{ id: string; message: string }>()

  // Arriving from search (#<id>): open that row and scroll to it.
  useEffect(() => {
    const row = location.hash && document.getElementById(location.hash.slice(1))
    if (!row) return
    row.querySelector('details')!.open = true
    row.scrollIntoView({ block: 'center' })
  }, [])

  async function save(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault()
    const form = e.currentTarget
    const values = Object.fromEntries(fields.map((f) => [f.name, String(new FormData(form).get(f.name) ?? '')]))
    try {
      await onSave(id, values)
      setError(undefined)
      form.closest('details')!.open = false
    } catch (err) {
      setError({ id, message: err instanceof Error ? err.message : 'Saving failed' })
    }
  }

  if (!items.length) return <p className="text-muted-foreground">Nothing here.</p>

  return (
    <ul className="records divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id} id={item.id} className={cn(item.archivedAt && 'archived')}>
          <details className="group">
            <summary className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/50', item.archivedAt && 'opacity-60')}>
              <span className="grid flex-1 gap-0.5">
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {[detail(item), `used in ${item.events} ${item.events === 1 ? 'event' : 'events'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t px-4 py-4">
              {canEdit ? (
                <form className="grid gap-4" onSubmit={(e) => save(e, item.id)}>
                  {fields.map((f) => {
                    const value = String((item as Record<string, unknown>)[f.name] ?? '')
                    return (
                      <Field key={f.name} label={f.label}>
                        {f.type === 'textarea' ? (
                          <Textarea name={f.name} rows={3} maxLength={f.max} defaultValue={value} />
                        ) : (
                          <Input name={f.name} type={f.type ?? 'text'} required={f.required} maxLength={f.max} defaultValue={value} />
                        )}
                      </Field>
                    )
                  })}
                  {error?.id === item.id && <FormError>{error.message}</FormError>}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => onArchive(item.id, !item.archivedAt)}>
                      {item.archivedAt ? 'Restore' : 'Archive'}
                    </Button>
                    <HistoryLink item={item.id} />
                  </div>
                </form>
              ) : (
                <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                  {fields.map((f) => (
                    <div key={f.name} className="contents">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="whitespace-pre-wrap">{String((item as Record<string, unknown>)[f.name] ?? '') || '–'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}
