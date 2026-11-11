import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { bandOp } from '#/server/fns'

type FileRow = { id: string; name: string; sizeBytes: number; contentType: string }
type Props = { band: string; owner: { song: string } | { event: string }; files: FileRow[]; canEdit: boolean }

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** Files attached to a song or event: links to download, and (members) upload and remove. */
export function Files({ band, owner, files, canEdit }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const picked = [...(input.files ?? [])]
    setError('')
    setBusy(true)
    for (const file of picked) {
      const form = new FormData()
      form.set('band', band)
      for (const [k, v] of Object.entries(owner)) form.set(k, v)
      form.set('file', file)
      const res = await fetch('/api/files', { method: 'POST', body: form })
      if (!res.ok) {
        setError(`${file.name}: ${(await res.text()) || 'upload failed'}`)
        break
      }
    }
    input.value = ''
    setBusy(false)
    await router.invalidate()
  }

  async function remove(f: FileRow) {
    if (!confirm(`Remove ${f.name}?`)) return
    await bandOp('archiveFile', band, { id: f.id })
    await router.invalidate()
  }

  if (!files.length && !canEdit) return null
  return (
    <section>
      <h2>Files</h2>
      {files.length > 0 ? (
        <ul aria-label="Files">
          {files.map((f) => (
            <li key={f.id}>
              <a href={`/api/files/${f.id}`}>{f.name}</a> ({size(f.sizeBytes)}){' '}
              {canEdit && (
                <button type="button" onClick={() => remove(f)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No files yet.</p>
      )}
      {canEdit && (
        <p>
          <label>
            Add files <input type="file" multiple onChange={upload} disabled={busy} />
          </label>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
