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

export const statusLabel = (s: string) => s[0].toUpperCase() + s.slice(1)
