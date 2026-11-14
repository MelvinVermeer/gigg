import { formatDuration } from '#/lib/duration'

type Song = { title: string; key: string | null; bpm: number | null; tuning: string | null; durationSec: number | null }

const cell = (v: string | number | null) => {
  const s = v == null ? '' : String(v)
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** A setlist as Excel-friendly CSV: semicolons, BOM, one header row, a blank row between sets, numbering per set. */
export function setlistCsv(sets: { songs: Song[] }[], header: string[]) {
  const rows = [
    header,
    ...sets.flatMap((set, i) => [
      ...(i ? [[]] : []),
      ...set.songs.map((s, n) => [n + 1, s.title, s.key, s.bpm, s.tuning, formatDuration(s.durationSec)]),
    ]),
  ]
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}
