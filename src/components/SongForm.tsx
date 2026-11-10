import { useState } from 'react'
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
    <form className="stack" onSubmit={submit}>
      <label>
        Title
        <input name="title" required maxLength={200} defaultValue={initial.title ?? ''} />
      </label>
      <div className="row">
        <label>
          Duration
          <input name="duration" placeholder="3:45" inputMode="numeric" defaultValue={formatDuration(initial.durationSec)} />
        </label>
        <label>
          Key
          <input name="key" maxLength={12} placeholder="Am" defaultValue={initial.key ?? ''} />
        </label>
        <label>
          BPM
          <input name="bpm" type="number" min={20} max={400} defaultValue={initial.bpm ?? ''} />
        </label>
      </div>
      <label>
        Tuning / instrument changes
        <input name="tuning" maxLength={200} defaultValue={initial.tuning ?? ''} />
      </label>
      <label>
        Notes
        <textarea name="notes" rows={5} maxLength={10_000} defaultValue={initial.notes ?? ''} />
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
