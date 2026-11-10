/**
 * Font size (mm) so a set fits one A4 page (portrait, 12mm margins): limited by the number of
 * lines and by the longest title (system-ui bold averages ~0.6em per character).
 */
export function stageFontMm(titles: string[]) {
  const longest = Math.max(1, ...titles.map((t) => t.length))
  return Math.min(22, 245 / (Math.max(1, titles.length) * 1.15), 180 / (longest * 0.6))
}
