// Song import/export as CSV. Pure: the import dialog (mapping step, warnings) and the server op
// (ops.ts importSongs) run the same conversion, so what the dialog warns about is what happens.
import { formatDuration } from './duration'
import { dicts } from './i18n'
import type { Dict } from './i18n'
import type { CustomField } from './song-fields'

/** Fixed song fields an import can fill, in export order. */
export const importFields = ['title', 'durationSec', 'key', 'bpm', 'tuning', 'tags', 'notes', 'lyrics'] as const
export type ImportField = (typeof importFields)[number]

/** Where a column goes: a fixed field, a custom field, a new custom field (named after the header), appended to notes, or nowhere. */
export type Target = `field:${ImportField}` | `custom:${string}` | 'new-custom' | 'notes' | 'skip'
export const existingChoices = ['skip', 'fill', 'overwrite'] as const
export type Existing = (typeof existingChoices)[number]

/**
 * Parse CSV text: BOM, quoted cells across lines, blank rows dropped. The delimiter (`,` `;` or tab)
 * is the one most lines have, and only when more than half have it: otherwise every line is one
 * cell, so a plain list of titles like "Hello, Goodbye" stays whole.
 */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.slice(0, 20_000).replace(/"[^"]*"/g, '').split(/\r?\n/).filter((l) => l.trim()).slice(0, 20)
  const having = (d: string) => lines.filter((l) => l.includes(d)).length
  const best = ['\t', ';', ','].reduce((a, b) => (having(b) > having(a) ? b : a))
  const delim = having(best) * 2 > lines.length ? best : undefined
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') cell += text[++i]
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delim) row.push(cell), (cell = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell), rows.push(row), (row = []), (cell = '')
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim()))
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}#]/gu, '')

const synonyms: Record<ImportField | 'skip', string[]> = {
  title: ['title', 'titel', 'song', 'songtitle', 'songtitel', 'name', 'naam', 'nummer', 'track'],
  durationSec: ['duration', 'duur', 'length', 'lengte', 'time', 'tijd'],
  key: ['key', 'toonsoort', 'toonaard', 'toon'],
  bpm: ['bpm', 'tempo'],
  tuning: ['tuning', 'stemming', 'instrument', 'instruments'],
  tags: ['tags', 'tag', 'labels', 'label'],
  notes: ['notes', 'note', 'notities', 'notitie', 'opmerkingen', 'opmerking', 'comments', 'remarks'],
  lyrics: ['lyrics', 'tekst', 'songtekst', 'text'],
  skip: ['#', 'nr', 'no', 'number'],
}

/** Every header that means a fixed field: synonyms plus the field names in every language (what the export writes). */
const known = new Map<string, Target>()
for (const [field, words] of Object.entries(synonyms)) for (const w of words) known.set(norm(w), field === 'skip' ? 'skip' : `field:${field as ImportField}`)
for (const t of Object.values(dicts)) for (const f of importFields) known.set(norm(exportName(t, f)), `field:${f}`)

/** A guess per header: the band's custom field by name first, then fixed fields; anything else goes to notes (nothing lost). */
export function guessTargets(headers: string[], custom: CustomField[]): Target[] {
  const used = new Set<Target>()
  return headers.map((h) => {
    const n = norm(h)
    const c = custom.find((f) => norm(f.name) === n)
    let target: Target = c ? `custom:${c.id}` : (known.get(n) ?? (n ? 'notes' : 'skip'))
    // Two columns can't both be the title (or the same field): the second goes to notes.
    if (target.startsWith('field:') || target.startsWith('custom:')) {
      if (used.has(target)) target = 'notes'
      used.add(target)
    }
    return target
  })
}

/**
 * Parsed rows → header + songs. A plain list of titles (one column, first line not a known header)
 * has no header row: every line is a song, under `titleName`.
 */
export function toTable(rows: string[][], custom: CustomField[], titleName: string) {
  const plainList = rows.length > 0 && rows.every((r) => r.filter((c) => c.trim()).length <= 1) && guessTargets([rows[0][0]], custom)[0] !== 'field:title'
  if (plainList) return { headers: [titleName], rows: rows.map((r) => [r.find((c) => c.trim()) ?? '']) }
  const [headers = [], ...rest] = rows
  return { headers, rows: rest }
}

/** A field (or custom field) more than one column goes to, if any: only one value can win. */
export const duplicateTarget = (targets: Target[]) =>
  targets.find((t, i) => (t.startsWith('field:') || t.startsWith('custom:')) && targets.indexOf(t) !== i)

/** The row with the most filled cells: the example shown next to each column. */
export const exampleRow = (rows: string[][]) =>
  rows.reduce<string[]>((best, r) => (r.filter((c) => c.trim()).length > best.filter((c) => c.trim()).length ? r : best), [])

/** Values a song takes from an import, the same limits as the song form. */
export type ImportValues = {
  title?: string
  durationSec?: number
  key?: string
  bpm?: number
  tuning?: string
  tags?: string[]
  notes?: string
  lyrics?: string
  custom?: Record<string, string>
}

/** One cell → a value, or `undefined` when it isn't understood. Callers skip empty cells first. */
export function convert(target: Target, raw: string): string | number | string[] | undefined {
  const v = raw.trim()
  switch (target) {
    case 'field:durationSec': {
      if (/^\d+$/.test(v)) return Number(v) <= 5999 ? Number(v) : undefined
      const m = /^(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)$/.exec(v)
      if (!m) return undefined
      const sec = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
      return sec <= 5999 ? sec : undefined
    }
    case 'field:bpm': {
      const m = /^(\d{2,3})\s*(bpm)?$/i.exec(v)
      return m && Number(m[1]) >= 20 && Number(m[1]) <= 400 ? Number(m[1]) : undefined
    }
    case 'field:tags': {
      const tags = [...new Set(v.split(/[,|]/).map((t) => t.trim().toLowerCase()).filter(Boolean))]
      return tags.length <= 30 && tags.every((t) => t.length <= 40) ? tags : undefined
    }
    case 'field:title':
      return v.length <= 200 ? v : undefined
    case 'field:key':
      return v.length <= 12 ? v : undefined
    case 'field:tuning':
      return v.length <= 200 ? v : undefined
    case 'field:notes':
      return v.length <= 10_000 ? v : undefined
    case 'field:lyrics':
      return v.length <= 20_000 ? v : undefined
    default: // custom fields (new ones too): one line, up to 100
      return target === 'notes' || target === 'skip' || (v.length <= 100 && !/[\r\n]/.test(v)) ? v : undefined
  }
}

/** What a column can't take: count and the first example. For the mapping step. */
export function columnProblems(rows: string[][], col: number, target: Target) {
  const bad = rows.map((r) => r[col] ?? '').filter((v) => v.trim() && convert(target, v) === undefined)
  return { count: bad.length, example: bad[0] ?? '' }
}

export type Cell = { column: string; value: string }

/**
 * One row → song values, the "add to notes" cells (see withNoteLines) and the cells that weren't
 * understood. `customIds` maps 'new-custom' columns to the field created for them.
 */
export function rowValues(headers: string[], targets: Target[], row: string[], customIds: Record<number, string> = {}) {
  const values: ImportValues = {}
  const custom: Record<string, string> = {}
  const noteLines: Cell[] = []
  const problems: Cell[] = []
  targets.forEach((target, i) => {
    const raw = row[i] ?? ''
    if (!raw.trim() || target === 'skip') return
    if (target === 'notes') return void noteLines.push({ column: headers[i].trim(), value: raw.trim() })
    const t: Target = target === 'new-custom' ? `custom:${customIds[i]}` : target
    const v = convert(t, raw)
    if (v === undefined) return void problems.push({ column: headers[i], value: raw.trim() })
    if (t.startsWith('custom:')) custom[t.slice(7)] = v as string
    else (values as Record<string, unknown>)[t.slice(6)] = v
  })
  if (Object.keys(custom).length) values.custom = custom
  return { values, noteLines, problems }
}
export type RowValues = ReturnType<typeof rowValues>

/**
 * Notes with "add to notes" cells appended as `Header: value` lines, leaving out lines the notes
 * already have (a re-import doesn't repeat them). Over the notes limit, nothing is appended: the
 * cells come back as `dropped`.
 */
export function withNoteLines(notes: string | null | undefined, cells: Cell[]) {
  const have = new Set((notes ?? '').split('\n'))
  const add = cells.map((c) => `${c.column}: ${c.value}`).filter((l) => !have.has(l))
  const joined = [notes, ...add].filter(Boolean).join('\n')
  if (joined.length > 10_000) return { notes: notes || null, dropped: cells }
  return { notes: joined || null, dropped: [] as Cell[] }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * What an import changes on an existing song: 'fill' takes values only for empty fields,
 * 'overwrite' for every non-empty cell; "add to notes" cells are appended either way. Only
 * real changes: `set` is null when the song stays as it is.
 */
export function mergeSong(old: SongRow, { values, noteLines }: RowValues, existing: 'fill' | 'overwrite') {
  const { title: _, custom = {}, notes, ...rest } = values
  const take = (current: unknown, next: unknown) =>
    !same(current, next) && (existing === 'overwrite' || current == null || current === '' || (Array.isArray(current) && !current.length))
  const set: Partial<SongRow> = Object.fromEntries(Object.entries(rest).filter(([f, v]) => take(old[f as keyof SongRow], v)))
  const changed = Object.fromEntries(Object.entries(custom).filter(([id, v]) => take(old.custom[id], v)))
  if (Object.keys(changed).length) set.custom = { ...old.custom, ...changed }
  const merged = withNoteLines(notes !== undefined && take(old.notes, notes) ? notes : old.notes, noteLines)
  if (merged.notes !== old.notes) set.notes = merged.notes
  return { set: Object.keys(set).length ? set : null, dropped: merged.dropped }
}

/** Header of a fixed field in the export (and recognised by the import), in one language. */
export function exportName(t: Dict, field: ImportField) {
  return field === 'durationSec' ? t.common.duration : t.common[field]
}

/** A song's importable fields as stored (and exported). */
export type SongRow = {
  title: string
  durationSec: number | null
  key: string | null
  bpm: number | null
  tuning: string | null
  tags: string[]
  notes: string | null
  lyrics: string | null
  custom: Record<string, string>
}

const cell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)

/** All songs as Excel-friendly CSV (semicolons, BOM, like the setlist CSV): fixed fields, then custom fields by name. */
export function songsCsv(songs: SongRow[], custom: CustomField[], t: Dict) {
  const header = [...importFields.map((f) => exportName(t, f)), ...custom.map((f) => f.name)]
  const rows = songs.map((s) => [
    s.title,
    formatDuration(s.durationSec),
    s.key ?? '',
    s.bpm == null ? '' : String(s.bpm),
    s.tuning ?? '',
    s.tags.join(', '),
    s.notes ?? '',
    s.lyrics ?? '',
    ...custom.map((f) => s.custom[f.id] ?? ''),
  ])
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}
