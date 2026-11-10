import { useState } from 'react'

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

  if (!items.length) return <p>Nothing here yet. They're added from the event form.</p>

  return (
    <ul className="records">
      {items.map((item) => (
        <li key={item.id} className={item.archivedAt ? 'archived' : undefined}>
          <details>
            <summary>
              <strong>{item.name}</strong>
              {item.archivedAt && <small> (archived)</small>}
              <br />
              <small>
                {[detail(item), `used in ${item.events} ${item.events === 1 ? 'event' : 'events'}`]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </summary>
            {canEdit ? (
              <form className="stack" onSubmit={(e) => save(e, item.id)}>
                {fields.map((f) => {
                  const value = String((item as Record<string, unknown>)[f.name] ?? '')
                  return (
                    <label key={f.name}>
                      {f.label}
                      {f.type === 'textarea' ? (
                        <textarea name={f.name} rows={3} maxLength={f.max} defaultValue={value} />
                      ) : (
                        <input name={f.name} type={f.type ?? 'text'} required={f.required} maxLength={f.max} defaultValue={value} />
                      )}
                    </label>
                  )
                })}
                {error?.id === item.id && <p role="alert">{error.message}</p>}
                <p>
                  <button type="submit">Save</button>{' '}
                  <button type="button" onClick={() => onArchive(item.id, !item.archivedAt)}>
                    {item.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                </p>
              </form>
            ) : (
              <dl className="fields">
                {fields.map((f) => (
                  <div key={f.name} style={{ display: 'contents' }}>
                    <dt>{f.label}</dt>
                    <dd>{String((item as Record<string, unknown>)[f.name] ?? '') || '–'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
        </li>
      ))}
    </ul>
  )
}
