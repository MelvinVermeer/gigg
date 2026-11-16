import { useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { formatDuration, parseDuration } from '#/lib/duration'
import type { SongFields } from '#/server/ops'
import { errorText, useT } from '#/lib/i18n'
import type { CustomField } from '#/lib/song-fields'

type Props = {
  initial?: Partial<SongFields>
  /** The band's active custom fields, one single-line input each. */
  customFields: CustomField[]
  submitLabel: string
  onSubmit: (fields: SongFields) => Promise<void>
}

const num = (v: FormDataEntryValue | null) => (String(v ?? '').trim() ? Number(v) : null)

export function SongForm({ initial = {}, customFields, submitLabel, onSubmit }: Props) {
  const t = useT()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const durationSec = parseDuration(String(f.get('duration')))
    if (durationSec === undefined) return setError(t.songs.durationFormat)
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        title: String(f.get('title')),
        durationSec,
        key: String(f.get('key')),
        bpm: num(f.get('bpm')),
        tuning: String(f.get('tuning')),
        notes: String(f.get('notes')),
        tags: String(f.get('tags'))
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        custom: Object.fromEntries(customFields.map((cf) => [cf.id, String(f.get(`custom-${cf.id}`))])),
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
      <div className="grid grid-cols-3 gap-4">
        <Field label={t.common.duration}>
          <Input name="duration" placeholder="3:45" inputMode="numeric" defaultValue={formatDuration(initial.durationSec)} />
        </Field>
        <Field label={t.common.key}>
          <Input name="key" maxLength={12} placeholder="Am" defaultValue={initial.key ?? ''} />
        </Field>
        <Field label={t.common.bpm}>
          <Input name="bpm" type="number" min={20} max={400} defaultValue={initial.bpm ?? ''} />
        </Field>
      </div>
      <Field label={t.songs.tuningLong}>
        <Input name="tuning" maxLength={200} defaultValue={initial.tuning ?? ''} />
      </Field>
      {customFields.map((cf) => (
        <Field key={cf.id} label={cf.name}>
          <Input name={`custom-${cf.id}`} maxLength={100} defaultValue={initial.custom?.[cf.id] ?? ''} />
        </Field>
      ))}
      <Field label={t.common.notes}>
        <Textarea name="notes" rows={5} maxLength={10_000} defaultValue={initial.notes ?? ''} />
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
