import { useRouter } from '@tanstack/react-router'
import { Archive, FileSpreadsheet, Plus, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { SongImport, downloadSongsCsv } from '#/components/SongImport'
import { bandOp } from '#/server/fns'
import { errorText, useT } from '#/lib/i18n'
import { columns, fieldName, fixedFields, outputs, playOutputs } from '#/lib/song-fields'
import type { CustomField, Output, Shown } from '#/lib/song-fields'

type Field = { id: string; name: string; archivedAt: Date | string | null }

/** The band's custom song fields: members add, rename (on blur / Enter) and archive them; readers see the list. */
export function SongFieldsCard({ band, fields, canEdit }: { band: { slug: string; name: string }; fields: Field[]; canEdit: boolean }) {
  const t = useT()
  const s = t.settings
  const router = useRouter()
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const active = fields.filter((f) => !f.archivedAt)
  const custom = active.map(({ id, name }) => ({ id, name }))
  const archived = fields.filter((f) => f.archivedAt)

  async function run(op: () => Promise<unknown>) {
    setError('')
    try {
      await op()
      await router.invalidate()
      return true
    } catch (err) {
      setError(errorText(t, err, s.couldNotSave))
      return false
    }
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = String(new FormData(form).get('name')).trim()
    if (name && (await run(() => bandOp('addSongField', band.slug, { name })))) form.reset()
  }

  function rename(f: Field, input: HTMLInputElement) {
    const name = input.value.trim()
    if (name === f.name) return
    if (!name) return void (input.value = f.name)
    run(() => bandOp('renameSongField', band.slug, { id: f.id, name })).then((ok) => ok || (input.value = f.name))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {s.songs}
        </CardTitle>
        <CardDescription>{s.songFieldsIntro(band.name)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {active.length ? (
          <ul aria-label={s.songs} className="divide-y rounded-lg border">
            {active.map((f) => (
              <li key={f.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                {canEdit ? (
                  <Input
                    aria-label={s.renameSongField(f.name)}
                    className="h-8 flex-1"
                    defaultValue={f.name}
                    maxLength={40}
                    onBlur={(e) => rename(f, e.currentTarget)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                ) : (
                  <span className="flex-1 py-1">{f.name}</span>
                )}
                {canEdit && (
                  <Button variant="ghost" size="icon-sm" aria-label={s.archiveSongField(f.name)} onClick={() => run(() => bandOp('archiveSongField', band.slug, { id: f.id }))}>
                    <Archive aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{s.noSongFields}</p>
        )}
        {canEdit && (
          <form onSubmit={add} className="flex gap-2">
            <Input name="name" aria-label={s.newSongField} placeholder={s.newSongField} required maxLength={40} className="flex-1" />
            <Button type="submit" variant="outline">
              <Plus aria-hidden /> {s.addSongField}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {archived.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{s.archivedSongFields(archived.length)}</summary>
            <ul className="mt-2 divide-y rounded-lg border">
              {archived.map((f) => (
                <li key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="flex-1 text-muted-foreground">{f.name}</span>
                  {canEdit && (
                    <Button variant="outline" size="sm" aria-label={s.restoreSongField(f.name)} onClick={() => run(() => bandOp('restoreSongField', band.slug, { id: f.id }))}>
                      {t.common.restore}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
        <Separator className="my-2" />
        <p className="text-sm text-muted-foreground">{t.songImport.settingsIntro}</p>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
              <Upload aria-hidden /> {t.songImport.button}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => downloadSongsCsv(band.slug, custom, t).then(() => setError(''), () => setError(t.common.somethingWrong))}>
            <FileSpreadsheet aria-hidden /> {t.songs.export}
          </Button>
        </div>
        {importing && <SongImport band={band.slug} custom={custom} onClose={() => setImporting(false)} />}
      </CardContent>
    </Card>
  )
}

/** Your own choice of song fields per setlist output, as a grid. Each tick saves right away. */
export function ShownFieldsCard({ band, custom, shown, online }: { band: { slug: string; name: string }; custom: CustomField[]; shown: Shown; online: boolean }) {
  const t = useT()
  const s = t.settings
  const router = useRouter()
  // Local state so ticks show at once; the band loader catches up after the save.
  const [value, setValue] = useState(shown)
  const queue = useRef(Promise.resolve())
  const [error, setError] = useState('')
  const c = t.common
  const rows = ['number', ...fixedFields, ...custom.map((f) => f.id), 'notes', 'play']
  const nameOf = (f: string) => fieldName(t, f, custom)

  function toggle(output: Output, field: string, on: boolean) {
    // Keep only fields that still exist, in display order.
    const next = { ...value, [output]: columns(on ? [...value[output], field] : value[output].filter((f) => f !== field), custom) }
    setValue(next)
    setError('')
    // One save at a time, in order, so quick ticks can't land out of order.
    queue.current = queue.current
      .then(() => bandOp('setShownFields', band.slug, next))
      .then(
        () => router.invalidate(),
        (err) => setError(errorText(t, err, s.couldNotSave)),
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {s.setlists}
        </CardTitle>
        <CardDescription>{s.shownIntro(band.name)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 font-medium">{s.field}</th>
                {outputs.map((o) => (
                  <th key={o} className="px-2 py-2 text-center font-medium">
                    {s.outputs[o]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pr-3">{c.title}</td>
                {outputs.map((o) => (
                  <td key={o} className="px-2 py-2 text-center">
                    <Checkbox checked disabled aria-label={s.show(c.title, s.outputs[o])} />
                  </td>
                ))}
              </tr>
              {rows.map((f) => (
                <tr key={f}>
                  <td className="py-2 pr-3 [overflow-wrap:anywhere]">{nameOf(f)}</td>
                  {outputs.map((o) => (
                    <td key={o} className="px-2 py-2 text-center">
                      <Checkbox
                        checked={value[o].includes(f)}
                        disabled={!online || (f === 'play' && !playOutputs.includes(o))}
                        aria-label={s.show(nameOf(f), s.outputs[o])}
                        onCheckedChange={(on) => toggle(o, f, on === true)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">{s.shownHint}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
