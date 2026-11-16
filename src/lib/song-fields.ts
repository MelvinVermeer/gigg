import { getRouteApi } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import type { Dict } from '#/lib/i18n'

/** Where a setlist is shown. Each person picks the song fields per output (Settings). */
export const outputs = ['page', 'show', 'print', 'excel'] as const
export type Output = (typeof outputs)[number]

/** Fixed song fields that can be shown, in display order; custom fields go before notes. */
export const fixedFields = ['key', 'bpm', 'tuning', 'durationSec'] as const
/** Field keys: 'number' (the 1. 2. in front), a fixed field name, 'notes', or a custom field's id. */
export type Shown = Record<Output, string[]>

/** Before someone picks: what each output showed before this setting existed. */
export const defaultShown: Shown = {
  page: ['number', 'key', 'durationSec'],
  show: ['number', 'key', 'notes'],
  print: ['number', 'key'],
  excel: ['number', 'key', 'bpm', 'tuning', 'durationSec'],
}

export type CustomField = { id: string; name: string }
export type SongValues = {
  title: string
  key?: string | null
  bpm?: number | null
  tuning?: string | null
  durationSec?: number | null
  notes?: string | null
  custom?: Record<string, string>
}

/** The ticked fields of one output in display order: number, fixed, custom (active ones, creation order), notes. */
export function columns(ticked: string[], custom: CustomField[]) {
  const all = ['number', ...fixedFields, ...custom.map((f) => f.id), 'notes']
  return all.filter((f) => ticked.includes(f))
}

/** A field's value as text ('' when empty). BPM gets its unit unless `bare` (Excel has headers). */
export function fieldText(song: SongValues, field: string, bare = false): string {
  switch (field) {
    case 'key':
      return song.key ?? ''
    case 'bpm':
      return song.bpm == null ? '' : bare ? String(song.bpm) : `${song.bpm} BPM`
    case 'tuning':
      return song.tuning ?? ''
    case 'durationSec':
      return formatDuration(song.durationSec)
    case 'notes':
      return song.notes ?? ''
    default:
      return song.custom?.[field] ?? ''
  }
}

/** The small text after a title: filled fields except notes (own line) and `except`, joined by " · ". */
export const inlineText = (song: SongValues, cols: string[], except: string[] = []) =>
  cols
    .filter((c) => c !== 'number' && c !== 'notes' && !except.includes(c))
    .map((c) => fieldText(song, c))
    .filter(Boolean)
    .join(' · ')

/** A field's name: fixed ones in the viewer's language, custom ones as typed. */
export function fieldName(t: Dict, field: string, custom: CustomField[]) {
  const c = t.common
  const fixed: Record<string, string> = { number: '#', key: c.key, bpm: c.bpm, tuning: c.tuning, durationSec: c.duration, notes: c.notes }
  return fixed[field] ?? custom.find((f) => f.id === field)?.name ?? field
}

const bandRoute = getRouteApi('/$band')

/** Your ticked fields for one output, in display order, and the band's custom fields (from the band loader). */
export function useShownFields(output: Output) {
  const { songFields, shown } = bandRoute.useLoaderData()
  return { cols: columns(shown[output], songFields), custom: songFields }
}
