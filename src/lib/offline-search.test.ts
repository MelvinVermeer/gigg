import { expect, it } from 'vitest'
import { searchLists } from './offline-search'

it('matches substrings across lists, ignoring case and accents', () => {
  const lists = {
    songs: [{ slug: 'cafe', title: 'Café del Mar', key: 'Am' }, { slug: 'x', title: 'Other', key: null }],
    events: [{ slug: 'gig', title: 'Gig', date: '2026-12-01', venue: 'Cafe Wilhelmina' }],
    venues: [{ slug: 'paradiso', name: 'Paradiso', address: null }],
    contacts: [{ id: 'c1', name: 'Ann', organisation: null, email: 'ann@cafe.nl' }],
  }
  expect(searchLists(' CAFE ', lists)).toEqual([
    { type: 'song', ref: 'cafe', label: 'Café del Mar', detail: 'Am', owner: null },
    { type: 'event', ref: 'gig', label: 'Gig', detail: '2026-12-01 · Cafe Wilhelmina', owner: null },
    { type: 'contact', ref: 'c1', label: 'Ann', detail: 'ann@cafe.nl', owner: null },
  ])
  expect(searchLists('', lists)).toEqual([])
})
