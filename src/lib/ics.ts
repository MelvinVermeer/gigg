// iCalendar (RFC 5545) feed for subscribed calendars (Google, Apple). Pure, so it's unit-tested.

export type IcsEvent = {
  id: string
  title: string
  date: string // 'YYYY-MM-DD'
  startTime: string | null // 'HH:MM' or 'HH:MM:SS', wall clock in timeZone
  endTime: string | null
  tentative: boolean
  location: string | null
  description: string | null
  url: string
}

/** Text values: escape \ ; , and newlines. */
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

/** Lines longer than 75 octets continue on the next line, starting with a space. */
function fold(line: string) {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = Buffer.byteLength(ch)
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const pad = (n: number) => String(n).padStart(2, '0')
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const dateValue = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`

/** Offset (ms) of timeZone from UTC at instant t. */
function offset(t: number, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(t)
      .map((x) => [x.type, Number(x.value)]),
  )
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t
}

/** Wall-clock date + time in timeZone → the UTC instant. Sent as UTC, so no VTIMEZONE is needed. */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  const guess = wall - offset(wall, timeZone)
  return new Date(wall - offset(guess, timeZone)) // second pass gets DST switch days right
}

const DAY = 86_400_000

export function toIcs(cal: { name: string; timeZone: string; events: IcsEvent[] }, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//gigg//calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(cal.name)}`, `X-WR-TIMEZONE:${cal.timeZone}`]
  for (const e of cal.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@gigg`, `DTSTAMP:${utcStamp(now)}`)
    if (e.startTime) {
      const start = zonedToUtc(e.date, e.startTime, cal.timeZone)
      let end = e.endTime ? zonedToUtc(e.date, e.endTime, cal.timeZone) : start
      if (end < start) end = zonedToUtc(new Date(Date.parse(`${e.date}T00:00Z`) + DAY).toISOString().slice(0, 10), e.endTime!, cal.timeZone)
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`)
    } else {
      const day = new Date(`${e.date}T00:00Z`)
      lines.push(`DTSTART;VALUE=DATE:${dateValue(day)}`, `DTEND;VALUE=DATE:${dateValue(new Date(+day + DAY))}`)
    }
    lines.push(`SUMMARY:${esc(e.tentative ? `(option) ${e.title}` : e.title)}`, `STATUS:${e.tentative ? 'TENTATIVE' : 'CONFIRMED'}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    lines.push(`DESCRIPTION:${esc([e.description, e.url].filter(Boolean).join('\n\n'))}`, `URL:${e.url}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
