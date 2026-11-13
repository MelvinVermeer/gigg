import { useRouter } from '@tanstack/react-router'
import { upload as uploadToBlob } from '@vercel/blob/client'
import { FileText, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { confirmDialog } from '#/components/ConfirmDialog'

type FileRow = { id: string; name: string; sizeBytes: number; contentType: string }
type Props = { band: string; owner: { song: string } | { event: string }; files: FileRow[]; canEdit: boolean }

type Mode = { direct: boolean; maxBytes: number }
let mode: Promise<Mode> | undefined
const uploadMode = () => (mode ??= fetch('/api/files').then((r) => r.json()))

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** Files attached to a song or event: links to download, and (members) upload and remove. */
export function Files({ band, owner, files, canEdit }: Props) {
  const router = useRouter()
  const t = useT()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const picked = [...(input.files ?? [])]
    setError('')
    const { direct, maxBytes } = await uploadMode()
    for (const file of picked) {
      setBusy(t.files.uploading(file.name))
      if (file.size > maxBytes) {
        setError(t.files.tooBig(file.name, maxBytes / 1024 / 1024))
        break
      }
      const owner_: Record<string, string> = owner
      let res: Response
      if (direct) {
        // Straight to Blob; then we record it. The random key is the blob's path.
        const key = crypto.randomUUID()
        try {
          await uploadToBlob(key, file, {
            access: 'private',
            handleUploadUrl: '/api/files/upload',
            clientPayload: JSON.stringify({ band }),
            contentType: file.type || 'application/octet-stream',
            multipart: file.size > 8 * 1024 * 1024,
            onUploadProgress: (p) => setBusy(`${t.files.uploading(file.name)} ${Math.round(p.percentage)}%`),
          })
        } catch (e) {
          setError(`${file.name}: ${e instanceof Error ? e.message : t.files.failed}`)
          break
        }
        res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ band, ...owner_, key, name: file.name }),
        })
      } else {
        const form = new FormData()
        form.set('band', band)
        for (const [k, v] of Object.entries(owner_)) form.set(k, v)
        form.set('file', file)
        res = await fetch('/api/files', { method: 'POST', body: form })
      }
      if (!res.ok) {
        setError(`${file.name}: ${(await res.text()) || t.files.failed}`)
        break
      }
    }
    input.value = ''
    setBusy('')
    await router.invalidate()
  }

  async function remove(f: FileRow) {
    if (!(await confirmDialog(t.files.removeConfirm(f.name), t.common.remove))) return
    await bandOp('archiveFile', band, { id: f.id })
    await router.invalidate()
  }

  if (!files.length && !canEdit) return null
  return (
    <Card aria-labelledby="files" role="region" className="mt-6">
      <CardHeader>
        <CardTitle id="files" role="heading" aria-level={2}>
          {t.files.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {files.length > 0 ? (
          <ul aria-label={t.files.title} className="divide-y">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
                <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <a href={`/api/files/${f.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                  {f.name}
                </a>
                <span className="shrink-0 text-muted-foreground">({size(f.sizeBytes)})</span>
                {canEdit && (
                  <Button variant="ghost" size="xs" className="ml-auto" onClick={() => remove(f)}>
                    <X aria-hidden /> {t.common.remove}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t.files.none}</p>
        )}
        {canEdit && (
          <div>
            <Button asChild variant="outline" size="sm" className="has-[:disabled]:opacity-50">
              <label>
                <Upload aria-hidden /> {t.files.add}
                <input type="file" multiple onChange={upload} disabled={!!busy} className="sr-only" />
              </label>
            </Button>
          </div>
        )}
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            {busy}
          </p>
        )}
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  )
}
