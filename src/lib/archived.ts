/** `?archived=true` on a list route shows the archived items instead. Nothing in the app links there except the manual. */
export const archivedSearch = (s: Record<string, unknown>): { archived?: true } =>
  s.archived === true || s.archived === 'true' ? { archived: true } : {}
