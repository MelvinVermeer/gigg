import { useState } from 'react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { formatDuration, parseDuration } from '#/lib/duration'
import type { SongFields } from '#/server/ops'

type Props = {
  initial?: Partial<SongFields>
  submitLabel: string
  onSubmit: (fields: SongFields) => Promise<void>
}

const num = (v: FormDataEntryValue | null) => (String(v ?? '').trim() ? Number(v) : null)

export function SongForm({ initial = {}, submitLabel, onSubmit }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const durationSec = parseDuration(String(f.get('duration')))
    if (durationSec === undefined) return setError('Duration must look like 3:45')
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
      <div className="grid grid-cols-3 gap-4">
        <Field label="Duration">
          <Input name="duration" placeholder="3:45" inputMode="numeric" defaultValue={formatDuration(initial.durationSec)} />
        </Field>
        <Field label="Key">
          <Input name="key" maxLength={12} placeholder="Am" defaultValue={initial.key ?? ''} />
        </Field>
        <Field label="BPM">
          <Input name="bpm" type="number" min={20} max={400} defaultValue={initial.bpm ?? ''} />
        </Field>
      </div>
      <Field label="Tuning / instrument changes">
        <Input name="tuning" maxLength={200} defaultValue={initial.tuning ?? ''} />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" rows={5} maxLength={10_000} defaultValue={initial.notes ?? ''} />
      </Field>
      <Field label="Tags" hint="(comma separated)">
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
