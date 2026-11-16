import { bandOp } from '#/server/fns'
import type { SearchResult } from '#/server/ops'

/**
 * The lists offline search reads. The band layout fetches them online so the service worker caches
 * them; the search page reads them back when the server can't be reached. Both call this, so the
 * request URLs (= cache keys) always match.
 */
export const offlineSearchLists = (band: string) => {
  const ok = <T,>(p: Promise<T[]>) => p.catch(() => null)
  return Promise.all([
    ok(bandOp('listSongs', band, { archived: false })),
    ok(bandOp('listEvents', band, { when: 'upcoming' })),
    ok(bandOp('listEvents', band, { when: 'past' })),
    ok(bandOp('listVenues', band, { archived: false })),
    ok(bandOp('listContacts', band, { archived: false })),
  ])
}

type Lists = {
  songs: { slug: string; title: string; key: string | null }[]
  events: { slug: string; title: string; date: string; venue: string | null }[]
  venues: { slug: string; name: string; address: string | null }[]
  contacts: { id: string; name: string; organisation: string | null; email: string | null }[]
}

const join = (sep: string, ...parts: (string | null)[]) => parts.filter(Boolean).join(sep) || null

/**
 * Search without the server: case- and accent-insensitive substring match over the cached lists.
 * ponytail: no typo tolerance and no files offline (the server's pg_trgm search has both).
 */
export function searchLists(q: string, l: Lists): SearchResult[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const needle = norm(q.trim())
  if (!needle) return []
  const hit = (...texts: (string | null)[]) => norm(texts.filter(Boolean).join(' ')).includes(needle)
  const r = (type: SearchResult['type'], ref: string, label: string, detail: string | null): SearchResult => ({
    type, ref, label, detail, owner: null,
  })
  return [
    ...l.songs.filter((s) => hit(s.title)).map((s) => r('song', s.slug, s.title, s.key)),
    ...l.events.filter((e) => hit(e.title, e.venue)).map((e) => r('event', e.slug, e.title, join(' · ', e.date, e.venue))),
    ...l.venues.filter((v) => hit(v.name, v.address)).map((v) => r('venue', v.slug, v.name, v.address)),
    ...l.contacts
      .filter((c) => hit(c.name, c.organisation, c.email))
      .map((c) => r('contact', c.id, c.name, join(' · ', c.organisation, c.email))),
  ].slice(0, 40)
}

/** The search page's fallback when the server can't be reached. Rethrows if nothing is cached. */
export async function searchOffline(band: string, q: string, error: unknown): Promise<SearchResult[]> {
  const [songs, upcoming, past, venues, contacts] = await offlineSearchLists(band)
  if (!songs && !upcoming && !past && !venues && !contacts) throw error
  return searchLists(q, {
    songs: songs ?? [],
    events: [...(upcoming ?? []), ...(past ?? [])],
    venues: venues ?? [],
    contacts: contacts ?? [],
  })
}
