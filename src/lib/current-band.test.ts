import { expect, test } from 'vitest'
import { currentBand } from './current-band'

const a = { slug: 'a' }
const b = { slug: 'b' }

test('cookie band if still a member, else the first band, else none', () => {
  expect(currentBand([a, b], 'theme=dark; band=b')).toBe(b)
  expect(currentBand([a, b], 'band=gone')).toBe(a)
  expect(currentBand([a, b], '')).toBe(a)
  expect(currentBand([], 'band=b')).toBeUndefined()
})
