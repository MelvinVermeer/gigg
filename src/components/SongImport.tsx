import { Link, useRouter } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Textarea } from '#/components/ui/textarea'
import { bandOp } from '#/server/fns'
import { errorText, useT } from '#/lib/i18n'
import type { Dict } from '#/lib/i18n'
import { columnProblems, duplicateTarget, exampleRow, existingChoices, exportName, guessTargets, importFields, parseCsv, songsCsv, toTable } from '#/lib/song-csv'
import type { Existing, Target } from '#/lib/song-csv'
import type { CustomField } from '#/lib/song-fields'

type Summary = Awaited<ReturnType<typeof bandOp<'importSongs'>>>

/** Files the import takes (also what the songs list accepts when dropped). */
export const isCsvFile = (f: File) => /\.(csv|tsv|txt)$/i.test(f.name) || /^text\//.test(f.type)

/** Export CSV: every active song (readers too). */
export async function downloadSongsCsv(band: string, custom: CustomField[], t: Dict) {
  const csv = songsCsv(await bandOp('listSongsForExport', band, {}), custom, t)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${band}-${t.common.songs.toLowerCase()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href))
}

type Props = {
  band: string
  custom: CustomField[]
  /** A dropped file's text: starts at the mapping step. */
  initial?: string
  /** On the songs page: the summary says where to import more. */
  hint?: boolean
  onClose: () => void
}

/** Open while mounted: upload or paste a CSV (or a plain list of titles), check the mapping per column, import, see what happened. */
export function SongImport({ band, custom, initial, hint, onClose }: Props) {
  const t = useT()
  const s = t.songImport
  const router = useRouter()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(() => (initial ? table(initial) : undefined))
  const [targets, setTargets] = useState<Target[]>(() => (parsed ? guessTargets(parsed.headers, custom) : []))
  const [existing, setExisting] = useState<Existing>('skip')
  const [summary, setSummary] = useState<Summary>()
  const [error, setError] = useState(initial && !parsed ? s.noRows : '')
  const [busy, setBusy] = useState(false)

  function table(csv: string) {
    const res = toTable(parseCsv(csv), custom, t.common.title)
    return res.rows.length ? res : undefined
  }

  function next(csv: string) {
    const res = table(csv)
    if (!res) return setError(s.noRows)
    setError('')
    setParsed(res)
    setTargets(guessTargets(res.headers, custom))
  }

  async function run() {
    if (!parsed) return
    setBusy(true)
    setError('')
    try {
      setSummary(await bandOp('importSongs', band, { ...parsed, targets, existing }))
      await router.invalidate()
    } catch (err) {
      setError(errorText(t, err, t.common.savingFailed))
    } finally {
      setBusy(false)
    }
  }

  const example = parsed ? exampleRow(parsed.rows) : []
  // What stops the import, checked here first (the server checks again).
  const blocker = !parsed || summary ? '' : !targets.includes('field:title') ? t.errors.importNoTitle : duplicateTarget(targets) ? t.errors.importDuplicateTarget : ''

  return (
    <Dialog open onOpenChange={(o) => o || onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{summary ? s.done(summary.created, summary.updated, summary.skipped) : parsed ? s.mapIntro(parsed.rows.length) : s.intro}</DialogDescription>
        </DialogHeader>

        {summary ? (
          <div className="grid gap-3 text-sm">
            {summary.problems.length > 0 && (
              <div>
                <p className="mb-1 font-medium">{s.problems}</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {summary.problems.map((p, i) => (
                    <li key={i}>
                      {p.title}: {p.column} “{p.value}”
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hint && (
              <p>
                {s.more}{' '}
                <Link to="/$band/settings" params={{ band }} className="underline underline-offset-4">
                  {s.toSettings}
                </Link>
              </p>
            )}
          </div>
        ) : parsed ? (
          <div className="grid gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">{s.column}</th>
                    <th className="py-2 pr-3 font-medium">{s.example}</th>
                    <th className="py-2 font-medium">{s.goesTo}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsed.headers.map((h, i) => {
                    const bad = columnProblems(parsed.rows, i, targets[i])
                    return (
                      <tr key={i} className="align-top">
                        <td className="py-2 pr-3 font-medium [overflow-wrap:anywhere]">{h}</td>
                        <td className="max-w-40 truncate py-2 pr-3 text-muted-foreground">{example[i]}</td>
                        <td className="py-2">
                          <NativeSelect
                            size="sm"
                            aria-label={s.goesToFor(h)}
                            value={targets[i]}
                            onChange={(e) => setTargets(targets.map((x, j) => (j === i ? (e.target.value as Target) : x)))}
                          >
                            {importFields.map((f) => (
                              <NativeSelectOption key={f} value={`field:${f}`}>
                                {exportName(t, f)}
                              </NativeSelectOption>
                            ))}
                            {custom.map((f) => (
                              <NativeSelectOption key={f.id} value={`custom:${f.id}`}>
                                {f.name}
                              </NativeSelectOption>
                            ))}
                            {h.trim() && h.trim().length <= 40 && <NativeSelectOption value="new-custom">{s.newField(h.trim())}</NativeSelectOption>}
                            <NativeSelectOption value="notes">{s.toNotes}</NativeSelectOption>
                            <NativeSelectOption value="skip">{s.skip}</NativeSelectOption>
                          </NativeSelect>
                          {bad.count > 0 && <p className="mt-1 text-xs text-destructive">{s.notUnderstood(bad.count, bad.example)}</p>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="import-existing">{s.existing}</Label>
              <NativeSelect id="import-existing" value={existing} onChange={(e) => setExisting(e.target.value as Existing)}>
                {existingChoices.map((x) => (
                  <NativeSelectOption key={x} value={x}>
                    {s.existingChoice[x]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div>
              <Button asChild variant="outline" size="sm">
                <label>
                  <Upload aria-hidden /> {s.file}
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/plain"
                    className="sr-only"
                    onChange={async (e) => {
                      const input = e.currentTarget
                      const f = input.files?.[0]
                      if (f) next(await f.text())
                      input.value = ''
                    }}
                  />
                </label>
              </Button>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="import-paste">{s.paste}</Label>
              <Textarea id="import-paste" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>
        )}

        {(error || blocker) && (
          <p role="alert" className="text-sm text-destructive">
            {error || blocker}
          </p>
        )}

        <DialogFooter>
          {summary ? (
            <Button onClick={onClose}>{t.common.done}</Button>
          ) : parsed ? (
            <>
              <Button variant="outline" onClick={() => setParsed(undefined)}>
                {s.back}
              </Button>
              <Button disabled={!!blocker || busy} onClick={run}>
                {s.go(parsed.rows.length)}
              </Button>
            </>
          ) : (
            <Button disabled={!text.trim()} onClick={() => next(text)}>
              {s.next}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
