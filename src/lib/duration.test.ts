import { expect, it } from 'vitest'
import { formatDuration, parseDuration } from './duration'

it('parses m:ss', () => {
  expect(parseDuration('3:45')).toBe(225)
  expect(parseDuration(' 12:05 ')).toBe(725)
  expect(parseDuration('')).toBeNull()
  for (const bad of ['3:7', '345', '3:60', 'abc', '1:02:03']) expect(parseDuration(bad), bad).toBeUndefined()
})

it('formats seconds', () => {
  expect(formatDuration(225)).toBe('3:45')
  expect(formatDuration(3930)).toBe('1:05:30')
  expect(formatDuration(0)).toBe('0:00')
  expect(formatDuration(null)).toBe('')
})

it('round-trips', () => {
  for (const s of ['0:00', '3:45', '59:59']) expect(formatDuration(parseDuration(s))).toBe(s)
})
