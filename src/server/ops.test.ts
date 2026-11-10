import { and, eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { bands, changes, contacts, memberships, songs, venues } from './db/schema'
import { bandOps, Forbidden, NotFound, slugify } from './ops'
import type { BandOpName } from './ops'
import { testDb } from './test-db'

const opNames = Object.keys(bandOps) as BandOpName[]
const memberOps = opNames.filter((op) => bandOps[op].minRole === 'member')

describe('authorisation', () => {
  it.each(opNames)('%s rejects users outside the band', async (op) => {
    const t = await testDb()
    await expect(bandOps[op](t.db, t.outsider, t.band, {})).rejects.toBeInstanceOf(Forbidden)
  })

  it.each(memberOps)('%s rejects readers', async (op) => {
    const t = await testDb()
    await expect(bandOps[op](t.db, t.reader, t.band, {})).rejects.toBeInstanceOf(Forbidden)
  })

  it('read-only transactions allow reads and reject writes', async () => {
    const t = await testDb()
    await expect(bandOps.listSongs(t.db, t.reader, t.band, {}, true)).resolves.toHaveLength(3)
    await expect(bandOps.getSetlist(t.db, t.reader, t.band, { event: 'summer-party' }, true)).resolves.toBeTruthy()
    await expect(bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' }, true)).rejects.toMatchObject({ cause: { message: expect.stringMatching(/read-only transaction/) } })
  })

  it('lets readers read', async () => {
    const t = await testDb()
    await expect(bandOps.listSongs(t.db, t.reader, t.band, {})).resolves.toHaveLength(3)
    await expect(bandOps.listEvents(t.db, t.reader, t.band, {})).resolves.toHaveLength(1)
    await expect(bandOps.getSong(t.db, t.reader, t.band, { slug: 'closer' })).resolves.toMatchObject({ moved: false })
  })

  it('rejects members who left the band', async () => {
    const t = await testDb()
    await t.db.update(memberships).set({ archivedAt: new Date() }).where(eq(memberships.userId, t.member))
    await expect(bandOps.listSongs(t.db, t.member, t.band, {})).rejects.toBeInstanceOf(Forbidden)
  })
})

describe('songs', () => {
  it('stores all fields, turning empty text into null and deduplicating tags', async () => {
    const t = await testDb()
    const song = await bandOps.createSong(t.db, t.member, t.band, {
      title: '  Blue Moon ',
      durationSec: 225,
      key: '',
      bpm: 96,
      tuning: 'Drop D',
      notes: '',
      tags: ['ballad', 'ballad', 'cover'],
    })
    expect(song).toMatchObject({ slug: 'blue-moon', title: 'Blue Moon', key: null, notes: null, tags: ['ballad', 'cover'] })
  })

  it('rejects invalid input', async () => {
    const t = await testDb()
    await expect(bandOps.createSong(t.db, t.member, t.band, { title: '  ' })).rejects.toThrow()
    await expect(bandOps.createSong(t.db, t.member, t.band, { title: 'X', bpm: 9000 })).rejects.toThrow()
  })

  it('gives duplicate titles their own slug and never uses reserved slugs', async () => {
    const t = await testDb()
    const a = await bandOps.createSong(t.db, t.member, t.band, { title: 'Closer' })
    const b = await bandOps.createSong(t.db, t.member, t.band, { title: 'New' })
    expect([a.slug, b.slug]).toEqual(['closer-2', 'new-2'])
  })

  it('keeps the old URL working after a rename', async () => {
    const t = await testDb()
    const renamed = await bandOps.updateSong(t.db, t.member, t.band, {
      slug: 'slow-one',
      fields: { title: 'Slow Two', durationSec: 260 },
    })
    expect(renamed.slug).toBe('slow-two')
    await expect(bandOps.getSong(t.db, t.reader, t.band, { slug: 'slow-one' })).resolves.toEqual({
      moved: true,
      slug: 'slow-two',
    })
  })

  it('keeps the slug when the title changes only in case or spacing', async () => {
    const t = await testDb()
    const song = await bandOps.updateSong(t.db, t.member, t.band, { slug: 'closer', fields: { title: 'CLOSER ' } })
    expect(song.slug).toBe('closer')
  })

  it('archives and restores instead of deleting', async () => {
    const t = await testDb()
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' })
    const active = await bandOps.listSongs(t.db, t.member, t.band, {})
    const archived = await bandOps.listSongs(t.db, t.member, t.band, { archived: true })
    expect(active.map((s) => s.slug)).not.toContain('closer')
    expect(archived.map((s) => s.slug)).toEqual(['closer'])

    await bandOps.restoreSong(t.db, t.member, t.band, { slug: 'closer' })
    expect((await bandOps.listSongs(t.db, t.member, t.band, {})).map((s) => s.slug)).toContain('closer')
  })

  it('returns NotFound for an unknown slug', async () => {
    const t = await testDb()
    await expect(bandOps.getSong(t.db, t.member, t.band, { slug: 'nope' })).rejects.toBeInstanceOf(NotFound)
    await expect(bandOps.archiveSong(t.db, t.member, t.band, { slug: 'nope' })).rejects.toBeInstanceOf(NotFound)
  })
})

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

describe('events', () => {
  it('slugs: title, then date-title, then date-title-2', async () => {
    const t = await testDb()
    const date = day(10)
    const a = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Summer Party', date })
    const b = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Summer Party', date })
    const c = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Brand New Gig', date })
    expect([a.slug, b.slug, c.slug]).toEqual([`${date}-summer-party`, `${date}-summer-party-2`, 'brand-new-gig'])
  })

  it('lists upcoming soonest first, past and archived separately', async () => {
    const t = await testDb()
    await bandOps.createEvent(t.db, t.member, t.band, { title: 'Tomorrow', date: day(1) })
    await bandOps.createEvent(t.db, t.member, t.band, { title: 'Today', date: day(0) })
    const upcoming = await bandOps.listEvents(t.db, t.member, t.band, {})
    expect(upcoming.map((e) => e.title)).toEqual(['Today', 'Tomorrow', 'Summer Party'])
    expect((await bandOps.listEvents(t.db, t.member, t.band, { when: 'past' })).map((e) => e.title)).toEqual([
      'Spring Show',
    ])
    await bandOps.archiveEvent(t.db, t.member, t.band, { slug: 'today' })
    expect((await bandOps.listEvents(t.db, t.member, t.band, { when: 'archived' })).map((e) => e.title)).toEqual([
      'Today',
    ])
  })

  it('creates a new venue and contacts inline and links them', async () => {
    const t = await testDb()
    const event = await bandOps.createEvent(t.db, t.member, t.band, {
      title: 'Club Night',
      date: day(5),
      venue: { name: 'Club X', address: 'Side Street 2' },
      contacts: [{ name: 'Sam Sound', phone: '0612' }, { name: 'Pat Promoter Two' }],
    })
    const res = await bandOps.getEvent(t.db, t.reader, t.band, { slug: event.slug })
    if (res.moved) throw new Error('unexpected redirect')
    expect(res.venue).toMatchObject({ name: 'Club X', slug: 'club-x', address: 'Side Street 2' })
    expect(res.contacts.map((c) => c.name)).toEqual(['Pat Promoter Two', 'Sam Sound'])
  })

  it('refuses venues and contacts of another band', async () => {
    const t = await testDb()
    const [other] = await t.db.insert(bands).values({ slug: 'other-band', name: 'Other' }).returning()
    const [venue] = await t.db.insert(venues).values({ bandId: other.id, slug: 'theirs', name: 'Theirs' }).returning()
    const [contact] = await t.db.insert(contacts).values({ bandId: other.id, name: 'Their contact' }).returning()
    await expect(
      bandOps.createEvent(t.db, t.member, t.band, { title: 'X', date: day(1), venue: { id: venue.id } }),
    ).rejects.toBeInstanceOf(NotFound)
    await expect(
      bandOps.createEvent(t.db, t.member, t.band, { title: 'X', date: day(1), contacts: [{ id: contact.id }] }),
    ).rejects.toBeInstanceOf(NotFound)
  })

  it('suggests the contacts used last time at a venue', async () => {
    const t = await testDb()
    const data = await bandOps.eventFormData(t.db, t.member, t.band, {})
    const hall = data.venues.find((v) => v.name === 'The Local Hall')!
    const pat = data.contacts.find((c) => c.name === 'Pat Promoter')!
    expect(data.lastContactsByVenue[hall.id]).toEqual([pat.id])

    // A later event at the same venue with someone else becomes the new suggestion.
    const sam = await bandOps.createEvent(t.db, t.member, t.band, {
      title: 'Autumn',
      date: day(60),
      venue: { id: hall.id },
      contacts: [{ name: 'Sam' }],
    })
    const after = await bandOps.eventFormData(t.db, t.member, t.band, {})
    const samId = after.contacts.find((c) => c.name === 'Sam')!.id
    expect(after.lastContactsByVenue[hall.id]).toEqual([samId])
    expect(sam.venueId).toBe(hall.id)
  })

  it('replaces contacts on update and redirects the old slug after a rename', async () => {
    const t = await testDb()
    const updated = await bandOps.updateEvent(t.db, t.member, t.band, {
      slug: 'summer-party',
      fields: { title: 'Summer Festival', date: day(30), contacts: [] },
    })
    expect(updated.slug).toBe('summer-festival')
    await expect(bandOps.getEvent(t.db, t.reader, t.band, { slug: 'summer-party' })).resolves.toEqual({
      moved: true,
      slug: 'summer-festival',
    })
    const res = await bandOps.getEvent(t.db, t.reader, t.band, { slug: 'summer-festival' })
    expect(!res.moved && res.contacts).toEqual([])
  })

  it('rejects an invalid date or status', async () => {
    const t = await testDb()
    await expect(bandOps.createEvent(t.db, t.member, t.band, { title: 'X', date: '2026-13-40' })).rejects.toThrow()
    await expect(
      bandOps.createEvent(t.db, t.member, t.band, { title: 'X', date: day(1), bookingStatus: 'maybe' }),
    ).rejects.toThrow()
  })
})

describe('venues & contacts', () => {
  it('lists active first with usage counts', async () => {
    const t = await testDb()
    const venueList = await bandOps.listVenues(t.db, t.reader, t.band, {})
    const contactList = await bandOps.listContacts(t.db, t.reader, t.band, {})
    expect(venueList).toMatchObject([{ name: 'The Local Hall', events: 2, archivedAt: null }])
    expect(contactList).toMatchObject([{ name: 'Pat Promoter', events: 2 }])
  })

  it('updates show up on events; empty text becomes null', async () => {
    const t = await testDb()
    const [hall] = await bandOps.listVenues(t.db, t.member, t.band, {})
    const [pat] = await bandOps.listContacts(t.db, t.member, t.band, {})
    await bandOps.updateVenue(t.db, t.member, t.band, { id: hall.id, fields: { name: 'The Big Hall', address: 'New Road 9' } })
    await bandOps.updateContact(t.db, t.member, t.band, { id: pat.id, fields: { name: 'Pat P.', email: '' } })
    const res = await bandOps.getEvent(t.db, t.reader, t.band, { slug: 'summer-party' })
    if (res.moved) throw new Error('unexpected redirect')
    expect(res.venue).toMatchObject({ name: 'The Big Hall', address: 'New Road 9' })
    expect(res.contacts).toEqual([expect.objectContaining({ name: 'Pat P.', email: null })])
  })

  it('archived ones leave the event form but stay on events, until restored', async () => {
    const t = await testDb()
    const [hall] = await bandOps.listVenues(t.db, t.member, t.band, {})
    const [pat] = await bandOps.listContacts(t.db, t.member, t.band, {})
    await bandOps.archiveVenue(t.db, t.member, t.band, { id: hall.id })
    await bandOps.archiveContact(t.db, t.member, t.band, { id: pat.id })

    const form = await bandOps.eventFormData(t.db, t.member, t.band, {})
    expect([form.venues, form.contacts]).toEqual([[], []])
    const res = await bandOps.getEvent(t.db, t.reader, t.band, { slug: 'summer-party' })
    expect(!res.moved && [res.venue?.name, res.contacts.map((c) => c.name)]).toEqual(['The Local Hall', ['Pat Promoter']])

    await bandOps.restoreVenue(t.db, t.member, t.band, { id: hall.id })
    await bandOps.restoreContact(t.db, t.member, t.band, { id: pat.id })
    const after = await bandOps.eventFormData(t.db, t.member, t.band, {})
    expect([after.venues.length, after.contacts.length]).toEqual([1, 1])
  })

  it("refuses to touch another band's venues and contacts", async () => {
    const t = await testDb()
    const [other] = await t.db.insert(bands).values({ slug: 'other-band', name: 'Other' }).returning()
    const [venue] = await t.db.insert(venues).values({ bandId: other.id, slug: 'theirs', name: 'Theirs' }).returning()
    const [contact] = await t.db.insert(contacts).values({ bandId: other.id, name: 'Their contact' }).returning()
    await expect(
      bandOps.updateVenue(t.db, t.member, t.band, { id: venue.id, fields: { name: 'Mine now' } }),
    ).rejects.toBeInstanceOf(NotFound)
    await expect(bandOps.archiveVenue(t.db, t.member, t.band, { id: venue.id })).rejects.toBeInstanceOf(NotFound)
    await expect(
      bandOps.updateContact(t.db, t.member, t.band, { id: contact.id, fields: { name: 'Mine now' } }),
    ).rejects.toBeInstanceOf(NotFound)
    await expect(bandOps.restoreContact(t.db, t.member, t.band, { id: contact.id })).rejects.toBeInstanceOf(NotFound)
  })
})

describe('setlists & blocks', () => {
  const ids = async (t: Awaited<ReturnType<typeof testDb>>) => {
    const list = await bandOps.listSongs(t.db, t.member, t.band, {})
    return Object.fromEntries(list.map((s) => [s.slug, s.id]))
  }

  it('saves sets with songs in order and sums durations on the event', async () => {
    const t = await testDb()
    const song = await ids(t)
    await bandOps.saveSetlist(t.db, t.member, t.band, {
      event: 'summer-party',
      sets: [
        { name: 'Set 1', songIds: [song['opening-song'], song['slow-one']] },
        { name: 'Set 2', songIds: [song.closer] },
      ],
    })
    const res = await bandOps.getSetlist(t.db, t.reader, t.band, { event: 'summer-party' })
    expect(res.sets.map((s) => [s.name, s.songs.map((x) => x.slug)])).toEqual([
      ['Set 1', ['opening-song', 'slow-one']],
      ['Set 2', ['closer']],
    ])
    const ev = await bandOps.getEvent(t.db, t.reader, t.band, { slug: 'summer-party' })
    expect(!ev.moved && ev.setlist).toEqual({ songs: 3, durationSec: 210 + 260 + 300 })
  })

  it('saving again replaces the sets', async () => {
    const t = await testDb()
    const song = await ids(t)
    const save = (sets: { name: string; songIds: string[] }[]) =>
      bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets })
    await save([{ name: 'A', songIds: [song.closer] }, { name: 'B', songIds: [] }])
    await save([{ name: 'Only', songIds: [song['slow-one'], song.closer] }])
    const res = await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    expect(res.sets).toEqual([{ name: 'Only', songs: [expect.objectContaining({ slug: 'slow-one' }), expect.objectContaining({ slug: 'closer' })] }])
  })

  it('copies a setlist from another event', async () => {
    const t = await testDb()
    const song = await ids(t)
    await bandOps.saveSetlist(t.db, t.member, t.band, {
      event: 'spring-show',
      sets: [{ name: 'Set 1', songIds: [song.closer, song['opening-song']] }],
    })
    const before = await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    expect(before.copyFrom.map((e) => e.name)).toEqual(['Spring Show'])

    await bandOps.copySetlist(t.db, t.member, t.band, { event: 'summer-party', from: before.copyFrom[0].id })
    const res = await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    expect(res.sets.map((s) => s.songs.map((x) => x.slug))).toEqual([['closer', 'opening-song']])
  })

  it('standalone setlists: build one, list it, start a new event from it', async () => {
    const t = await testDb()
    const song = await ids(t)
    const { id } = await bandOps.createSetlist(t.db, t.member, t.band, { name: 'Standard show' })
    await bandOps.saveSetlist(t.db, t.member, t.band, {
      setlist: id,
      sets: [{ name: 'Set 1', songIds: [song['opening-song'], song.closer] }],
    })
    expect(await bandOps.listSetlists(t.db, t.reader, t.band, {})).toEqual([
      { id, name: 'Standard show', archivedAt: null, songs: 2, durationSec: 510 },
    ])
    // Offered first when copying, and in the new-event form.
    expect((await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })).copyFrom[0]).toMatchObject({ id, date: null })
    expect((await bandOps.eventFormData(t.db, t.member, t.band, {})).setlists).toEqual([{ id, name: 'Standard show' }])

    const ev = await bandOps.createEvent(t.db, t.member, t.band, {
      title: 'Club Night', date: '2027-03-01', venue: null, contacts: [], setlistFrom: id,
    })
    const copy = await bandOps.getSetlist(t.db, t.member, t.band, { event: ev.slug })
    expect(copy.sets.map((s) => s.songs.map((x) => x.slug))).toEqual([['opening-song', 'closer']])

    // A copy: editing the original leaves the event alone.
    await bandOps.saveSetlist(t.db, t.member, t.band, { setlist: id, sets: [] })
    expect((await bandOps.getSetlist(t.db, t.member, t.band, { event: ev.slug })).sets).toHaveLength(1)

    await bandOps.archiveSetlist(t.db, t.member, t.band, { id })
    expect((await bandOps.eventFormData(t.db, t.member, t.band, {})).setlists).toEqual([])
  })

  it("an event's setlist can't be addressed as a standalone one", async () => {
    const t = await testDb()
    const song = await ids(t)
    await bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'S', songIds: [song.closer] }] })
    const [{ id }] = (await bandOps.getSetlist(t.db, t.member, t.band, { event: 'spring-show' })).copyFrom
    await expect(bandOps.getStandaloneSetlist(t.db, t.member, t.band, { id })).rejects.toBeInstanceOf(NotFound)
    await expect(bandOps.archiveSetlist(t.db, t.member, t.band, { id })).rejects.toBeInstanceOf(NotFound)
  })

  it("refuses another band's songs", async () => {
    const t = await testDb()
    const [other] = await t.db.insert(bands).values({ slug: 'other-band', name: 'Other' }).returning()
    const [theirs] = await t.db.insert(songs).values({ bandId: other.id, slug: 'theirs', title: 'Theirs' }).returning()
    await expect(
      bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'S', songIds: [theirs.id] }] }),
    ).rejects.toBeInstanceOf(NotFound)
    await expect(bandOps.saveBlock(t.db, t.member, t.band, { name: 'B', songIds: [theirs.id] })).rejects.toBeInstanceOf(
      NotFound,
    )
  })

  it('blocks: create, update, archive; archived blocks are not offered in the builder', async () => {
    const t = await testDb()
    const song = await ids(t)
    const { id } = await bandOps.saveBlock(t.db, t.member, t.band, { name: 'Encore', songIds: [song.closer] })
    await bandOps.saveBlock(t.db, t.member, t.band, { id, name: 'Encore!', songIds: [song['slow-one'], song.closer] })
    const { blocks } = await bandOps.listBlocks(t.db, t.reader, t.band, {})
    expect(blocks.map((b) => [b.name, b.songs.map((s) => s.slug)])).toEqual([['Encore!', ['slow-one', 'closer']]])

    await bandOps.archiveBlock(t.db, t.member, t.band, { id })
    expect((await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })).blocks).toEqual([])
    expect((await bandOps.listBlocks(t.db, t.member, t.band, {})).blocks[0].archivedAt).not.toBeNull()
  })

  it('archived songs stay in existing setlists but are not offered for new ones', async () => {
    const t = await testDb()
    const song = await ids(t)
    await bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'S', songIds: [song.closer] }] })
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' })
    const res = await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    expect(res.sets[0].songs.map((s) => s.slug)).toEqual(['closer'])
    expect(res.songs.map((s) => s.slug)).not.toContain('closer')
  })
})

describe('search', () => {
  const find = async (t: Awaited<ReturnType<typeof testDb>>, q: string) =>
    (await bandOps.search(t.db, t.reader, t.band, { q })).map((r) => `${r.type}:${r.label}`)

  it('finds by substring and puts the best match first', async () => {
    const t = await testDb()
    expect((await find(t, 'clos'))[0]).toBe('song:Closer')
    expect(await find(t, 'SLOW')).toContain('song:Slow One')
  })

  it('tolerates typos', async () => {
    const t = await testDb()
    expect(await find(t, 'closr')).toContain('song:Closer')
    expect(await find(t, 'promotor')).toContain('contact:Pat Promoter')
  })

  it('finds events by venue name, and the venue itself', async () => {
    const t = await testDb()
    const results = await find(t, 'local hall')
    expect(results).toEqual(expect.arrayContaining(['venue:The Local Hall', 'event:Summer Party', 'event:Spring Show']))
  })

  it('returns refs the links need: slugs for songs/events, ids for venues/contacts', async () => {
    const t = await testDb()
    const [song] = await bandOps.search(t.db, t.reader, t.band, { q: 'closer' })
    expect(song).toMatchObject({ type: 'song', ref: 'closer', detail: 'G' })
    const contact = (await bandOps.search(t.db, t.reader, t.band, { q: 'pat' })).find((r) => r.type === 'contact')!
    expect(contact.ref).toMatch(/^[0-9a-f-]{36}$/)
    expect(contact.detail).toBe('pat@example.com')
  })

  it("leaves out archived items and other bands' data", async () => {
    const t = await testDb()
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' })
    const [other] = await t.db.insert(bands).values({ slug: 'other-band', name: 'Other' }).returning()
    await t.db.insert(songs).values({ bandId: other.id, slug: 'closer-theirs', title: 'Closer Theirs' })
    expect((await find(t, 'closer')).filter((r) => r.startsWith('song:'))).toEqual([])
  })

  it('treats % and _ as text, and returns nothing for an empty query', async () => {
    const t = await testDb()
    expect(await find(t, '%')).toEqual([])
    expect(await find(t, '_')).toEqual([])
    expect(await find(t, '   ')).toEqual([])
  })
})

describe('audit trail', () => {
  it('logs a write with the acting user and band', async () => {
    const t = await testDb()
    const song = await bandOps.createSong(t.db, t.member, t.band, { title: 'Brand New Song' })
    const [change] = await t.db
      .select()
      .from(changes)
      .where(and(eq(changes.tableName, 'songs'), eq(changes.rowId, song.id)))
    expect(change).toMatchObject({ action: 'insert', userId: t.member, bandId: song.bandId, before: null })
    expect(change.after).toMatchObject({ title: 'Brand New Song', slug: 'brand-new-song' })
  })

  it('logs an archive as an update with before and after', async () => {
    const t = await testDb()
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' })
    const [change] = await t.db
      .select()
      .from(changes)
      .where(and(eq(changes.tableName, 'songs'), eq(changes.action, 'update')))
    expect(change.userId).toBe(t.member)
    expect(change.before).toMatchObject({ archived_at: null })
    expect(change.after).toMatchObject({ archived_at: expect.any(String) })
  })

  it('is attached to every table except auth internals', async () => {
    const t = await testDb()
    const notAudited = ['changes', 'sessions', 'accounts', 'verifications', 'passkeys']
    const { rows } = (await t.db.execute(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      except
      select distinct event_object_table from information_schema.triggers where trigger_name = 'audit'`)) as unknown as {
      rows: { table_name: string }[]
    }
    expect(rows.map((r) => r.table_name).filter((n) => !notAudited.includes(n))).toEqual([])
  })
})

describe('history & undo', () => {
  const latest = async (t: Awaited<ReturnType<typeof testDb>>) => (await bandOps.listChanges(t.db, t.reader, t.band, {}))[0]
  const undoLatest = async (t: Awaited<ReturnType<typeof testDb>>) =>
    bandOps.undo(t.db, t.member, t.band, { txId: (await latest(t)).txId })
  const song = (t: Awaited<ReturnType<typeof testDb>>, slug: string) => bandOps.getSong(t.db, t.reader, t.band, { slug })

  it('describes a save in plain language, with who did it', async () => {
    const t = await testDb()
    await bandOps.updateSong(t.db, t.member, t.band, { slug: 'closer', fields: { title: 'Big Closer', key: 'A' } })
    expect(await latest(t)).toMatchObject({ who: 'Dev Member', lines: ['Changed song “Big Closer”: bpm, key, title, duration'], canUndo: true })
  })

  it('undoes a rename, including the slug redirect', async () => {
    const t = await testDb()
    await bandOps.updateSong(t.db, t.member, t.band, { slug: 'closer', fields: { title: 'Big Closer', durationSec: 300, key: 'G', bpm: 140 } })
    expect(await undoLatest(t)).toEqual({ ok: true })
    expect(await song(t, 'closer')).toMatchObject({ moved: false, song: { title: 'Closer' } })
    await expect(song(t, 'big-closer')).rejects.toBeInstanceOf(NotFound)
  })

  it('undoes an archive, and the undo itself can be undone', async () => {
    const t = await testDb()
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' })
    expect((await latest(t)).lines).toEqual(['Archived song “Closer”'])
    await undoLatest(t)
    expect((await latest(t)).lines).toEqual(['Restored song “Closer”'])
    expect(await song(t, 'closer')).toMatchObject({ song: { archivedAt: null } })
    await undoLatest(t)
    expect(await song(t, 'closer')).toMatchObject({ song: { archivedAt: expect.any(Date) } })
  })

  it('undoes a setlist save back to the previous version', async () => {
    const t = await testDb()
    const id = Object.fromEntries((await bandOps.listSongs(t.db, t.member, t.band, {})).map((s) => [s.slug, s.id]))
    const save = (songIds: string[]) =>
      bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'Set 1', songIds }] })
    await save([id.closer])
    await save([id['slow-one'], id['opening-song']])
    expect((await latest(t)).lines).toEqual(['Changed setlist “Summer Party”'])
    expect(await undoLatest(t)).toEqual({ ok: true })
    const res = await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    expect(res.sets.map((s) => s.songs.map((x) => x.slug))).toEqual([['closer']])
  })

  it('refuses when the row changed again later', async () => {
    const t = await testDb()
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'closer' })
    const first = await latest(t)
    await bandOps.restoreSong(t.db, t.member, t.band, { slug: 'closer' })
    expect(await bandOps.undo(t.db, t.member, t.band, { txId: first.txId })).toMatchObject({ ok: false, reason: /changed again/ })
    expect(await song(t, 'closer')).toMatchObject({ song: { archivedAt: null } })
  })

  it('refuses when later changes depend on it', async () => {
    const t = await testDb()
    const created = await bandOps.createSong(t.db, t.member, t.band, { title: 'New One' })
    const first = await latest(t)
    await bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'Set 1', songIds: [created.id] }] })
    expect(await bandOps.undo(t.db, t.member, t.band, { txId: first.txId })).toMatchObject({ ok: false, reason: /depend/ })
    expect(await song(t, 'new-one')).toMatchObject({ moved: false })
  })
})

it('slugify', () => {
  expect(slugify('A Day in the Life')).toBe('a-day-in-the-life')
  expect(slugify('  Café   Olé!! ')).toBe('cafe-ole')
  expect(slugify('!!!')).toBe('untitled')
})
