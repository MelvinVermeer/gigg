/** Search-box labels; a detail is added only when names collide, so each label maps to one item. */
export function withLabels<T>(items: T[], name: (t: T) => string, detail: (t: T) => string | null) {
  const count = new Map<string, number>()
  for (const i of items) count.set(name(i), (count.get(name(i)) ?? 0) + 1)
  return items.map((i) => ({
    ...i,
    label: count.get(name(i))! > 1 && detail(i) ? `${name(i)} · ${detail(i)}` : name(i),
  }))
}
