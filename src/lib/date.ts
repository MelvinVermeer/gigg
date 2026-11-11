/** "2026-12-05" → "Sat 5 Dec 2026". Fixed locale and UTC, so server and browser render the same. */
export function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "21:00:00", "01:30:00" → "21:00–01:30"; just the start without an end; "" without times. */
export function formatTimes(start: string | null, end: string | null) {
  return start ? `${start.slice(0, 5)}${end ? `–${end.slice(0, 5)}` : ''}` : ''
}

/** "Sat 5 Dec 2026 · 21:00–01:30" */
export const formatWhen = (e: { date: string; startTime?: string | null; endTime?: string | null }) =>
  [formatDate(e.date), formatTimes(e.startTime ?? null, e.endTime ?? null)].filter(Boolean).join(' · ')

export const statusLabel = (s: string) => s[0].toUpperCase() + s.slice(1)
