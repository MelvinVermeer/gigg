/** Where a dragged song lands: a gap in one of the lists (0 = before the first row, length = after the last). */
export type Gap = { list: number; index: number }

/** Moves `lists[from.list][from.index]` to the gap `to`, or removes it when `to` is null. Same reference back when nothing changes. */
export function applyDrop<T>(lists: T[][], from: Gap, to: Gap | null): T[][] {
  if (to && to.list === from.list && (to.index === from.index || to.index === from.index + 1)) return lists
  const item = lists[from.list][from.index]
  const next = lists.map((l, i) => (i === from.list ? l.filter((_, j) => j !== from.index) : l))
  if (to) {
    // The gap was counted with the item still in place.
    const index = to.list === from.list && to.index > from.index ? to.index - 1 : to.index
    next[to.list] = [...next[to.list].slice(0, index), item, ...next[to.list].slice(index)]
  }
  return next
}
