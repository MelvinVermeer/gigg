import { describe, expect, it } from 'vitest'
import { toIcs, zonedToUtc } from './ics'
import type { IcsEvent } from './ics'

const base: IcsEvent = { id: 'e1', title: 'Gig', date: '2026-12-14', startTime: null, endTime: null, tentative: false, location: null, description: null, url: 'https://x/e' }
const ics = (e: Partial<IcsEvent>) => toIcs({ name: 'gigg – Band', timeZone: 'Europe/Amsterdam', events: [{ ...base, ...e }] }, new Date('2026-01-01T00:00:00Z'))

describe('ics', () => {
  it('converts Amsterdam wall clock to UTC, summer and winter', () => {
    expect(zonedToUtc('2026-12-14', '21:00', 'Europe/Amsterdam').toISOString()).toBe('2026-12-14T20:00:00.000Z')
    expect(zonedToUtc('2026-07-01', '21:00:00', 'Europe/Amsterdam').toISOString()).toBe('2026-07-01T19:00:00.000Z')
  })

  it('makes an all-day event without times', () => {
    expect(ics({})).toContain('DTSTART;VALUE=DATE:20261214\r\nDTEND;VALUE=DATE:20261215')
  })

  it('runs past midnight when the end is before the start', () => {
    expect(ics({ startTime: '21:00', endTime: '01:30' })).toContain('DTSTART:20261214T200000Z\r\nDTEND:20261215T003000Z')
  })

  it('marks options tentative, escapes text, adds the link, folds long lines', () => {
    const out = ics({ tentative: true, title: 'A, b; c', location: 'Paradiso, Amsterdam', description: 'Load-in 18:00\nParking: back' + 'x'.repeat(100) })
    expect(out).toContain(String.raw`SUMMARY:(option) A\, b\; c`)
    expect(out).toContain('STATUS:TENTATIVE')
    expect(out).toContain('LOCATION:Paradiso\\, Amsterdam')
    expect(out).toContain('DESCRIPTION:Load-in 18:00\\nParking: back')
    expect(out.replace(/\r\n /g, '')).toContain('\\n\\nhttps://x/e')
    expect(out.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true)
  })
})
