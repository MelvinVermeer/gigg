import { useRouter } from '@tanstack/react-router'
import { upload as uploadToBlob } from '@vercel/blob/client'
import { FileText, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { bandOp } from '#/server/fns'
import { cn } from '#/lib/utils'
import { useT } from '#/lib/i18n'
import { confirmDialog } from '#/components/ConfirmDialog'
import { AudioPlayer, isAudio } from '#/components/AudioPlayer'

type FileRow = { id: string; name: string; sizeBytes: number; contentType: string }
type Props = { band: string; owner: { song: string } | { event: string }; files: FileRow[]; canEdit: boolean }

type Mode = { direct: boolean; maxBytes: number }
let mode: Promise<Mode> | undefined
const uploadMode = () => (mode ??= fetch('/api/files').then((r) => r.json()))

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** Files attached to a song or event: links to download, and (members) upload, by button or drop, and remove. */
export function Files({ band, owner, files, canEdit }: Props) {
  const router = useRouter()
  const t = useT()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const [dragging, setDragging] = useState(false)

  async function upload(picked: File[]) {
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
    setBusy('')
    await router.invalidate()
  }

  async function remove(f: FileRow) {
    if (!(await confirmDialog(t.files.removeConfirm(f.name), t.common.remove))) return
    await bandOp('archiveFile', band, { id: f.id })
    await router.invalidate()
  }

  // Members can drop files anywhere on the card; it's outlined while files are dragged over it.
  const canDrop = canEdit && !busy
  const dropProps = canDrop
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          setDragging(false)
          upload([...e.dataTransfer.files])
        },
      }
    : {}

  if (!files.length && !canEdit) return null
  return (
    <Card
      aria-labelledby="files"
      role="region"
      className={cn('mt-6', dragging && 'outline-2 outline-offset-2 outline-primary outline-dashed')}
      {...dropProps}
    >
      <CardHeader>
        <CardTitle id="files" role="heading" aria-level={2}>
          {t.files.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {files.length > 0 ? (
          <ul aria-label={t.files.title} className="divide-y">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-2 py-2 text-sm">
                {isAudio(f.contentType) ? (
                  <AudioPlayer files={[f]} label={f.name} />
                ) : (
                  <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                )}
                <a href={`/api/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                  {f.name}
                </a>
                <span className="hidden shrink-0 text-muted-foreground sm:inline">({size(f.sizeBytes)})</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={t.files.remove(f.name)}
                    onClick={() => remove(f)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{canEdit ? t.files.noneDrop : t.files.none}</p>
        )}
        {canEdit && (
          <div>
            <Button asChild variant="outline" size="sm" className="has-[:disabled]:opacity-50">
              <label>
                <Upload aria-hidden /> {t.files.add}
                <input
                  type="file"
                  multiple
                  onChange={async (e) => {
                    const input = e.currentTarget
                    await upload([...(input.files ?? [])])
                    input.value = ''
                  }}
                  disabled={!!busy}
                  className="sr-only"
                />
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
