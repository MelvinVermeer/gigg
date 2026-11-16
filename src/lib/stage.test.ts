import { expect, it } from 'vitest'
import { stageFontMm } from './stage'

const songs = (...titles: string[]) => titles.map((title) => ({ title }))

it('shrinks with more songs and longer titles, capped for short sets', () => {
  expect(stageFontMm(songs('Closer'))).toBe(22)
  const twenty = stageFontMm(songs(...Array(20).fill('Song')))
  expect(twenty * 1.15 * 20).toBeLessThanOrEqual(245)
  expect(stageFontMm(songs('A much longer song title than usual'))).toBeLessThan(stageFontMm(songs('Short')))
  expect(stageFontMm([])).toBe(22)
})

it('counts the small text after a title and note lines under it', () => {
  const title = 'A medium length song title'
  expect(stageFontMm([{ title, extra: 'Am · 120 BPM · Drop D · Lead: Anna' }])).toBeLessThan(stageFontMm([{ title }]))
  const plain = stageFontMm(songs(...Array(15).fill('Song')))
  expect(stageFontMm(Array(15).fill({ title: 'Song', notes: 'capo 2\ncount in slow' }))).toBeLessThan(plain)
})
