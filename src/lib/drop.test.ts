import { expect, it } from 'vitest'
import { applyDrop } from './drop'

const lists = [['a', 'b', 'c'], ['d']]

it('reorders within a list, counting gaps with the item still in place', () => {
  expect(applyDrop(lists, { list: 0, index: 0 }, { list: 0, index: 3 })).toEqual([['b', 'c', 'a'], ['d']])
  expect(applyDrop(lists, { list: 0, index: 2 }, { list: 0, index: 0 })).toEqual([['c', 'a', 'b'], ['d']])
})

it('moves between lists, into empty ones too', () => {
  expect(applyDrop(lists, { list: 0, index: 1 }, { list: 1, index: 0 })).toEqual([['a', 'c'], ['b', 'd']])
  expect(applyDrop([['a'], []], { list: 0, index: 0 }, { list: 1, index: 0 })).toEqual([[], ['a']])
})

it('removes when dropped outside', () => {
  expect(applyDrop(lists, { list: 1, index: 0 }, null)).toEqual([['a', 'b', 'c'], []])
})

it('returns the same lists when dropped where it was', () => {
  expect(applyDrop(lists, { list: 0, index: 1 }, { list: 0, index: 1 })).toBe(lists)
  expect(applyDrop(lists, { list: 0, index: 1 }, { list: 0, index: 2 })).toBe(lists)
})
