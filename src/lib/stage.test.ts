import { expect, it } from 'vitest'
import { stageFontMm } from './stage'

it('shrinks with more songs and longer titles, capped for short sets', () => {
  expect(stageFontMm(['Closer'])).toBe(22)
  const twenty = stageFontMm(Array(20).fill('Song'))
  expect(twenty * 1.15 * 20).toBeLessThanOrEqual(245)
  expect(stageFontMm(['A much longer song title than usual'])).toBeLessThan(stageFontMm(['Short']))
  expect(stageFontMm([])).toBe(22)
})
