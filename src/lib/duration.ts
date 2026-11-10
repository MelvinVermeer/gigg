/** "3:45" → 225. "" → null. Anything else → undefined (invalid). */
export function parseDuration(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t)
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined
}

/** 225 → "3:45", 3930 → "1:05:30", null → "". */
export function formatDuration(sec: number | null | undefined) {
  if (sec == null) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
