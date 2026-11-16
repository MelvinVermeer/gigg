/**
 * Font size (mm) so a set fits one A4 page (portrait, 12mm margins): limited by the number of
 * lines and by the longest line (system-ui bold averages ~0.6em per character). Each song is its
 * title plus optional small text after it and note lines under it, both at `small` of the size.
 */
export const small = 0.45

export function stageFontMm(songs: { title: string; extra?: string; notes?: string }[]) {
  const width = (s: (typeof songs)[number]) => s.title.length + (s.extra ? (s.extra.length + 1) * small : 0)
  const longest = Math.max(1, ...songs.map(width), ...songs.flatMap((s) => (s.notes ? s.notes.split('\n').map((l) => l.length * small) : [])))
  const lines = songs.reduce((n, s) => n + 1 + (s.notes ? s.notes.split('\n').length * small : 0), 0)
  return Math.min(22, 245 / (Math.max(1, lines) * 1.15), 180 / (longest * 0.6))
}
