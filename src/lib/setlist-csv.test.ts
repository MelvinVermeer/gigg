import { expect, it } from 'vitest'
import { setlistCsv } from './setlist-csv'

it('setlistCsv: blank row between sets, numbering per set, quoting', () => {
  const song = (title: string, durationSec: number | null = null) => ({ title, key: 'Am', bpm: 120, tuning: null, durationSec })
  const csv = setlistCsv([{ songs: [song('Intro; "live"', 225), song('Two')] }, { songs: [song('Encore')] }], ['#', 'Title', 'Key', 'BPM', 'Tuning', 'Duration'])
  expect(csv).toBe(
    '﻿#;Title;Key;BPM;Tuning;Duration\r\n' +
      '1;"Intro; ""live""";Am;120;;3:45\r\n' +
      '2;Two;Am;120;;\r\n' +
      '\r\n' +
      '1;Encore;Am;120;;\r\n',
  )
})
