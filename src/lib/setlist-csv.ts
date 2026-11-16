import { fieldText } from '#/lib/song-fields'
import type { SongValues } from '#/lib/song-fields'

const cell = (v: string | number | null) => {
  const s = v == null ? '' : String(v)
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/**
 * A setlist as Excel-friendly CSV: semicolons, BOM, one header row, a blank row between sets,
 * numbering per set ('number' in `fields`, always first). Columns: #, title, then the other `fields` (see
 * lib/song-fields.ts); `header` names all of them.
 */
export function setlistCsv(sets: { songs: SongValues[] }[], fields: string[], header: string[]) {
  const rows = [
    header,
    ...sets.flatMap((set, i) => [
      ...(i ? [[]] : []),
      ...set.songs.map((s, n) => [
        ...(fields.includes('number') ? [n + 1] : []),
        s.title,
        ...fields.filter((f) => f !== 'number').map((f) => fieldText(s, f, true)),
      ]),
    ]),
  ]
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}
