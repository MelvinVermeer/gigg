/** "2026-12-05" → "Sat 5 Dec 2026" (en-GB) or "za 5 dec 2026" (nl-NL). UTC, so server and browser render the same. */
export function formatDate(isoDate: string, intl = 'en-GB') {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(intl, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "2026-12-05" → "Saturday 5 December 2026", for emails. */
export const formatLongDate = (isoDate: string, intl = 'en-GB') =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "21:00:00", "01:30:00" → "21:00–01:30"; just the start without an end; "" without times. */
export function formatTimes(start: string | null, end: string | null) {
  return start ? `${start.slice(0, 5)}${end ? `–${end.slice(0, 5)}` : ''}` : ''
}

/** "Sat 5 Dec 2026 · 21:00–01:30" */
export const formatWhen = (e: { date: string; startTime?: string | null; endTime?: string | null }, intl = 'en-GB') =>
  [formatDate(e.date, intl), formatTimes(e.startTime ?? null, e.endTime ?? null)].filter(Boolean).join(' · ')
