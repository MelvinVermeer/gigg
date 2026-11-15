import { and, eq, sql } from 'drizzle-orm'
import { describe, expect, it, onTestFinished } from 'vitest'
import { bands, changes, contacts, events, memberships, setlists, songs, users, venues } from './db/schema'
import { answerByToken, archiveBand, availabilityByToken, bandOps, calendarByToken, createBand, deleteBandForever, fileForDownload, Forbidden, listAllBands, listFeedback, myBands, NotFound, setFeedbackDone, slugify } from './ops'
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

  it("marks mine: I'm a participant (whatever I answered) or I created it", async () => {
    const t = await testDb()
    await bandOps.createEvent(t.db, t.member, t.band, { title: 'Lead Gig', date: day(3), people: [t.reader] })
    const mine = async (user: string) => (await bandOps.listEvents(t.db, user, t.band, {})).map((e) => [e.title, e.bookingStatus, e.mine])
    // Every status, everyone's. The member created Lead Gig, so sees it without being on it (the seed puts the member on Summer Party).
    expect(await mine(t.member)).toEqual([['Lead Gig', 'lead', true], ['Summer Party', 'confirmed', true]])
    expect(await mine(t.reader)).toEqual([['Lead Gig', 'lead', true], ['Summer Party', 'confirmed', false]])
    await bandOps.answerAvailability(t.db, t.reader, t.band, { event: 'lead-gig', answer: 'no' })
    expect((await mine(t.reader))[0]).toEqual(['Lead Gig', 'lead', true])
    // Without participants the event is only the creator's.
    await bandOps.updateEvent(t.db, t.member, t.band, { slug: 'lead-gig', fields: { title: 'Lead Gig', date: day(3), people: [] } })
    expect((await mine(t.reader))[0]).toEqual(['Lead Gig', 'lead', false])
    expect((await mine(t.member))[0]).toEqual(['Lead Gig', 'lead', true])
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

  it('lists the events per date for the same-date warning, without cancelled or archived ones', async () => {
    const t = await testDb()
    await bandOps.createEvent(t.db, t.member, t.band, { title: 'Off', date: day(5), bookingStatus: 'cancelled' })
    const gone = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Gone', date: day(5) })
    await bandOps.archiveEvent(t.db, t.member, t.band, { slug: gone.slug })
    const kept = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Kept', date: day(5), bookingStatus: 'option' })
    const data = await bandOps.eventFormData(t.db, t.member, t.band, {})
    expect(data.events.filter((e) => e.date === day(5))).toEqual([
      { slug: kept.slug, title: 'Kept', date: day(5), bookingStatus: 'option' },
    ])
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

  it('shows a venue or contact with its events, newest first', async () => {
    const t = await testDb()
    const { venue, events: venueEvents } = await bandOps.getVenue(t.db, t.reader, t.band, { slug: 'the-local-hall' })
    expect(venue.name).toBe('The Local Hall')
    expect(venueEvents.map((e) => e.slug)).toEqual(['summer-party', 'spring-show'])
    const [pat] = await bandOps.listContacts(t.db, t.reader, t.band, {})
    const { contact, events: contactEvents } = await bandOps.getContact(t.db, t.reader, t.band, { id: pat.id })
    expect(contact.email).toBe('pat@example.com')
    expect(contactEvents.map((e) => e.slug)).toEqual(['summer-party', 'spring-show'])
    // Archived ones still open (old events link to them).
    await bandOps.archiveContact(t.db, t.member, t.band, { id: pat.id })
    await expect(bandOps.getContact(t.db, t.reader, t.band, { id: pat.id })).resolves.toMatchObject({ contact: { archivedAt: expect.any(Date) } })
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
    await expect(bandOps.getVenue(t.db, t.member, t.band, { slug: 'theirs' })).rejects.toBeInstanceOf(NotFound)
    await expect(bandOps.getContact(t.db, t.member, t.band, { id: contact.id })).rejects.toBeInstanceOf(NotFound)
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

  it('standalone setlists: build one, list it, use it as an event standard, customize it', async () => {
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
    const standards = async () => {
      const ev = await bandOps.getEvent(t.db, t.member, t.band, { slug: 'summer-party' })
      return !ev.moved && ev.standards
    }
    // Offered on the event page.
    expect(await standards()).toEqual([{ id, name: 'Standard show' }])

    await bandOps.useStandardSetlist(t.db, t.member, t.band, { event: 'summer-party', setlist: id })
    expect((await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })).standard).toEqual({ id, name: 'Standard show' })

    // Customize: a copy, so editing the original leaves the event alone.
    await bandOps.useCustomSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    await bandOps.saveSetlist(t.db, t.member, t.band, { setlist: id, sets: [] })
    const copy = await bandOps.getSetlist(t.db, t.member, t.band, { event: 'summer-party' })
    expect(copy.standard).toBeNull()
    expect(copy.sets.map((s) => s.songs.map((x) => x.slug))).toEqual([['opening-song', 'closer']])

    await bandOps.archiveSetlist(t.db, t.member, t.band, { id })
    expect(await standards()).toEqual([])
  })

  it("an event's setlist can't be addressed as a standalone one", async () => {
    const t = await testDb()
    const song = await ids(t)
    await bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'S', songIds: [song.closer] }] })
    const [{ id }] = await t.db.select({ id: setlists.id }).from(setlists).innerJoin(events, eq(events.id, setlists.eventId)).where(eq(events.slug, 'summer-party'))
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
    expect((await bandOps.listBlocks(t.db, t.member, t.band, {})).blocks).toEqual([])
    expect((await bandOps.listBlocks(t.db, t.member, t.band, { archived: true })).blocks[0].archivedAt).not.toBeNull()
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

  it('returns refs the links need: slugs for songs/events/venues, ids for contacts', async () => {
    const t = await testDb()
    const [song] = await bandOps.search(t.db, t.reader, t.band, { q: 'closer' })
    expect(song).toMatchObject({ type: 'song', ref: 'closer', detail: 'G' })
    const contact = (await bandOps.search(t.db, t.reader, t.band, { q: 'pat' })).find((r) => r.type === 'contact')!
    expect(contact.ref).toMatch(/^[0-9a-f-]{36}$/)
    expect(contact.detail).toBe('pat@example.com')
    const venue = (await bandOps.search(t.db, t.reader, t.band, { q: 'local hall' })).find((r) => r.type === 'venue')!
    expect(venue.ref).toBe('the-local-hall')
  })

  it('finds files by name, with what they are attached to', async () => {
    const t = await testDb()
    const upload = { contentType: 'application/pdf', sizeBytes: 10, blobPath: '00000000-0000-4000-8000-000000000001' }
    const f = await bandOps.addFile(t.db, t.member, t.band, { ...upload, name: 'Closer chords.pdf', song: 'closer' })
    await bandOps.addFile(t.db, t.member, t.band, { ...upload, name: 'Stage plot.pdf', event: 'summer-party' })
    const hits = (await bandOps.search(t.db, t.reader, t.band, { q: 'chords' })).filter((r) => r.type === 'file')
    expect(hits).toEqual([{ type: 'file', ref: f.id, label: 'Closer chords.pdf', detail: 'Closer', owner: 'song' }])
    expect(await find(t, 'stage plot')).toContain('file:Stage plot.pdf')
    await bandOps.archiveFile(t.db, t.member, t.band, { id: f.id })
    expect(await find(t, 'chords')).not.toContain('file:Closer chords.pdf')
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
    const notAudited = ['changes', 'sessions', 'accounts', 'verifications', 'passkeys', 'calendar_feeds'] // feeds: history would show the secret token
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

describe('history', () => {
  const latest = async (t: Awaited<ReturnType<typeof testDb>>) => (await bandOps.listChanges(t.db, t.reader, t.band, {}))[0]

  it('describes a save in plain language, with who did it', async () => {
    const t = await testDb()
    await bandOps.updateSong(t.db, t.member, t.band, { slug: 'closer', fields: { title: 'Big Closer', key: 'A' } })
    expect(await latest(t)).toMatchObject({ who: 'Dev Member', lines: ['Changed song “Big Closer”: bpm, key, title, duration'] })
  })

  it('filters to one item and its children', async () => {
    const t = await testDb()
    const id = Object.fromEntries((await bandOps.listSongs(t.db, t.member, t.band, {})).map((s) => [s.slug, s.id]))
    await bandOps.archiveSong(t.db, t.member, t.band, { slug: 'slow-one' })
    await bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'Set 1', songIds: [id.closer] }] })
    await bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'Set 1', songIds: [id['opening-song']] }] })
    const of = async (item: string) => (await bandOps.listChanges(t.db, t.reader, t.band, { item })).flatMap((s) => s.lines)
    expect(await of(id['slow-one'])).toEqual(expect.arrayContaining(['Archived song “Slow One”']))
    expect(await of(id['slow-one'])).not.toContain('Changed setlist “Summer Party”')
    const { event } = await bandOps.getSetlist(t.db, t.reader, t.band, { event: 'summer-party' })
    const eventLines = await of(event.id)
    expect(eventLines.filter((l) => l === 'Changed setlist “Summer Party”')).toHaveLength(2)
    expect(eventLines).not.toContain('Archived song “Slow One”')
  })

  it('does not list contacts as changed when only the event notes change', async () => {
    const t = await testDb()
    const created = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Gig', date: '2026-12-01', contacts: [{ name: 'Sam' }] })
    const res = await bandOps.getEvent(t.db, t.reader, t.band, { slug: created.slug })
    if (res.moved) throw new Error('moved')
    await bandOps.updateEvent(t.db, t.member, t.band, {
      slug: res.event.slug,
      fields: { title: 'Gig', date: '2026-12-01', notes: 'Bring cables', contacts: res.contacts.map((c) => ({ id: c.id })) },
    })
    expect((await latest(t)).lines).toEqual(['Changed event “Gig”: notes'])
  })

  it('shows each change as before → after, with names instead of ids', async () => {
    const t = await testDb()
    await bandOps.updateSong(t.db, t.member, t.band, { slug: 'closer', fields: { title: 'Big Closer', key: 'A' } })
    expect((await latest(t)).diffs).toContainEqual({ what: 'Song “Big Closer”', field: 'title', from: 'Closer', to: 'Big Closer' })

    const id = Object.fromEntries((await bandOps.listSongs(t.db, t.member, t.band, {})).map((s) => [s.slug, s.id]))
    const save = (songIds: string[]) =>
      bandOps.saveSetlist(t.db, t.member, t.band, { event: 'summer-party', sets: [{ name: 'Set 1', songIds }] })
    await save([id['big-closer']])
    await save([id['slow-one'], id['big-closer']])
    expect((await latest(t)).diffs).toEqual([
      { what: 'Setlist “Summer Party”', field: 'sets', from: 'Set 1: Big Closer', to: 'Set 1: Slow One, Big Closer' },
    ])

    const created = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Gig', date: '2026-12-01', contacts: [{ name: 'Sam' }] })
    await bandOps.updateEvent(t.db, t.member, t.band, { slug: created.slug, fields: { title: 'Gig', date: '2026-12-01', contacts: [] } })
    expect((await latest(t)).diffs).toEqual([{ what: 'Event “Gig”', field: 'contact', from: 'Sam', to: '–' }])
  })
})

it('slugify', () => {
  expect(slugify('A Day in the Life')).toBe('a-day-in-the-life')
  expect(slugify('  Café   Olé!! ')).toBe('cafe-ole')
  expect(slugify('!!!')).toBe('untitled')
})

describe('admin', () => {
  it('creates a band with its first member, who may then sign in', async () => {
    const t = await testDb()
    const band = await createBand(t.db, { name: 'Demo Band', email: ' New@Example.com ' })
    expect(band.slug).toBe('demo-band-2')
    const [user] = await t.db.select().from(users).where(eq(users.email, 'new@example.com'))
    await expect(bandOps.listSongs(t.db, user.id, band.slug, {})).resolves.toEqual([])
    await expect(bandOps.createSong(t.db, user.id, band.slug, { title: 'X' })).resolves.toBeTruthy()
  })

  it('adds an existing user, avoids route slugs and requires a member', async () => {
    const t = await testDb()
    await createBand(t.db, { name: 'Second', email: 'member@example.com' })
    expect((await myBands(t.db, t.member)).map((b) => b.slug)).toEqual(['demo-band', 'second'])
    expect((await createBand(t.db, { name: 'Admin', email: 'a@example.com' })).slug).toBe('admin-2')
    await expect(createBand(t.db, { name: 'Ghost', email: '' })).rejects.toThrow()
    expect((await listAllBands(t.db)).map((b) => b.name)).not.toContain('Ghost')
  })

  it('deletes a band for everyone', async () => {
    const t = await testDb()
    await archiveBand(t.db, t.band)
    await expect(bandOps.listSongs(t.db, t.member, t.band, {})).rejects.toBeInstanceOf(Forbidden)
    expect(await listAllBands(t.db)).toMatchObject([{ slug: t.band, archivedAt: expect.any(Date) }])
    await expect(archiveBand(t.db, t.band)).rejects.toBeInstanceOf(NotFound)
  })

  it('deletes an archived band permanently, history included, keeping other bands and users', async () => {
    const t = await testDb()
    const other = await createBand(t.db, { name: 'Other', email: 'member@example.com' })
    await bandOps.createSong(t.db, t.member, other.slug, { title: 'Keep me' })
    await expect(deleteBandForever(t.db, t.band)).rejects.toBeInstanceOf(NotFound) // not archived yet
    const [{ id }] = await t.db.select({ id: bands.id }).from(bands).where(eq(bands.slug, t.band))
    await archiveBand(t.db, t.band)
    await deleteBandForever(t.db, t.band)
    expect((await listAllBands(t.db)).map((b) => b.slug)).toEqual([other.slug])
    expect(await t.db.select().from(changes).where(eq(changes.bandId, id))).toEqual([])
    await expect(bandOps.listSongs(t.db, t.member, other.slug, {})).resolves.toHaveLength(1)
    expect(await t.db.select().from(users).where(eq(users.id, t.reader))).toHaveLength(1)
  })
})

describe('files', () => {
  const upload = { name: 'chart.pdf', contentType: 'application/pdf', sizeBytes: 10, blobPath: '00000000-0000-4000-8000-000000000001' }

  it('attaches several files to a song or event, lists them, and archives one', async () => {
    const t = await testDb()
    const a = await bandOps.addFile(t.db, t.member, t.band, { ...upload, song: 'closer' })
    await bandOps.addFile(t.db, t.member, t.band, { ...upload, name: 'second.pdf', blobPath: '00000000-0000-4000-8000-000000000002', song: 'closer' })
    await bandOps.addFile(t.db, t.member, t.band, { ...upload, event: 'summer-party' })
    const song = await bandOps.getSong(t.db, t.reader, t.band, { slug: 'closer' })
    expect(song.moved === false && song.files.map((f) => f.name)).toEqual(['chart.pdf', 'second.pdf'])
    const event = await bandOps.getEvent(t.db, t.reader, t.band, { slug: 'summer-party' })
    expect(event.moved === false && event.files).toHaveLength(1)
    await bandOps.archiveFile(t.db, t.member, t.band, { id: a.id })
    const after = await bandOps.getSong(t.db, t.reader, t.band, { slug: 'closer' })
    expect(after.moved === false && after.files).toHaveLength(1)
    await expect(bandOps.addFile(t.db, t.member, t.band, { ...upload, song: 'closer', event: 'summer-party' })).rejects.toThrow()
  })

  it('serves a file to band members only', async () => {
    const t = await testDb()
    const f = await bandOps.addFile(t.db, t.member, t.band, { ...upload, song: 'closer' })
    await expect(fileForDownload(t.db, t.reader, f.id)).resolves.toMatchObject({ blobPath: '00000000-0000-4000-8000-000000000001' })
    await expect(fileForDownload(t.db, t.outsider, f.id)).rejects.toBeInstanceOf(NotFound)
  })

  it('the admin list shows the bytes stored per band', async () => {
    const t = await testDb()
    await bandOps.addFile(t.db, t.member, t.band, { ...upload, sizeBytes: 1000, song: 'closer' })
    await bandOps.addFile(t.db, t.member, t.band, { ...upload, sizeBytes: 500, blobPath: '00000000-0000-4000-8000-000000000009', event: 'summer-party' })
    expect(await listAllBands(t.db)).toMatchObject([{ slug: t.band, fileBytes: 1500 }])
  })
})

describe('feedback', () => {
  it('lets any band user send feedback; the admin overview lists it', async () => {
    const t = await testDb()
    await bandOps.sendFeedback(t.db, t.reader, t.band, { body: ' Love it ' })
    await expect(bandOps.sendFeedback(t.db, t.reader, t.band, { body: '  ' })).rejects.toThrow()
    await expect(bandOps.sendFeedback(t.db, t.outsider, t.band, { body: 'hi' })).rejects.toBeInstanceOf(Forbidden)
    const [item] = await listFeedback(t.db)
    expect(item).toMatchObject({ body: 'Love it', email: 'reader@example.com', band: expect.any(String), doneAt: null })

    await setFeedbackDone(t.db, item.id, true)
    expect((await listFeedback(t.db))[0].doneAt).toBeInstanceOf(Date)
    await setFeedbackDone(t.db, item.id, false)
    expect((await listFeedback(t.db))[0].doneAt).toBeNull()
  })
})

describe('members', () => {
  it('a member invites, changes a role, and removes; a removed person loses access and can be re-invited', async () => {
    const t = await testDb()
    const invited = await bandOps.inviteMember(t.db, t.member, t.band, { email: ' New@Example.com ', role: 'reader' })
    expect(invited).toMatchObject({ email: 'new@example.com', role: 'reader' })
    const [{ id }] = await t.db.select({ id: users.id }).from(users).where(eq(users.email, 'new@example.com'))
    await expect(bandOps.listSongs(t.db, id, t.band, {})).resolves.toBeTruthy()
    await expect(bandOps.createSong(t.db, id, t.band, { title: 'X' })).rejects.toBeInstanceOf(Forbidden)

    await bandOps.inviteMember(t.db, t.member, t.band, { email: 'new@example.com', role: 'member' })
    await expect(bandOps.createSong(t.db, id, t.band, { title: 'X' })).resolves.toBeTruthy()
    expect((await bandOps.listMembers(t.db, t.member, t.band, {})).find((m) => m.email === 'new@example.com')?.role).toBe('member')

    await bandOps.removeMember(t.db, t.member, t.band, { email: 'new@example.com' })
    await expect(bandOps.listSongs(t.db, id, t.band, {})).rejects.toBeInstanceOf(Forbidden)
    await bandOps.inviteMember(t.db, t.member, t.band, { email: 'new@example.com', role: 'reader' })
    await expect(bandOps.listSongs(t.db, id, t.band, {})).resolves.toBeTruthy()
  })

  it('shows adding, changing and removing members in the history', async () => {
    const t = await testDb()
    await bandOps.inviteMember(t.db, t.member, t.band, { email: 'new@example.com', role: 'reader' })
    await bandOps.inviteMember(t.db, t.member, t.band, { email: 'new@example.com', role: 'member' })
    await bandOps.removeMember(t.db, t.member, t.band, { email: 'new@example.com' })
    const lines = (await bandOps.listChanges(t.db, t.reader, t.band, {})).flatMap((s) => s.lines)
    expect(lines.slice(0, 3)).toEqual(['Removed member “new@example.com”', 'Changed “new@example.com” from reader to member', 'Added reader “new@example.com”'])
  })

  it('refuses bad emails and removing yourself', async () => {
    const t = await testDb()
    await expect(bandOps.inviteMember(t.db, t.member, t.band, { email: 'nope', role: 'reader' })).rejects.toThrow()
    await expect(bandOps.removeMember(t.db, t.member, t.band, { email: 'member@example.com' })).rejects.toThrow('cannotRemoveYourself')
  })
})

describe('availability', () => {
  type T = Awaited<ReturnType<typeof testDb>>
  /** An event with the member and the reader on it. */
  const gig = (t: T) => bandOps.createEvent(t.db, t.member, t.band, { title: 'Gig', date: day(20), people: [t.member, t.reader] })
  const ask = (t: T, user?: string) => bandOps.askAvailability(t.db, t.member, t.band, { event: 'gig', user })
  const people = async (t: T) =>
    (await bandOps.getAvailability(t.db, t.reader, t.band, { event: 'gig' })).people.map((p) => [p.email, p.asked, p.answer, p.mine])
  const lines = async (t: T) => (await bandOps.listChanges(t.db, t.reader, t.band, {})).flatMap((s) => s.lines)

  it('adds people from the event form without asking them; removing shows in the history', async () => {
    const t = await testDb()
    await gig(t)
    expect(await people(t)).toEqual([
      ['member@example.com', false, null, false],
      ['reader@example.com', false, null, true],
    ])
    expect(await lines(t)).toContainEqual('Added “Dev Reader” to event “Gig”')
    const fields = { title: 'Gig', date: day(20) }
    await bandOps.updateEvent(t.db, t.member, t.band, { slug: 'gig', fields }) // no `people`: list unchanged
    expect(await people(t)).toHaveLength(2)
    await bandOps.answerAvailability(t.db, t.reader, t.band, { event: 'gig', answer: 'yes' })
    await bandOps.updateEvent(t.db, t.member, t.band, { slug: 'gig', fields: { ...fields, people: [t.member] } })
    expect(await people(t)).toEqual([['member@example.com', false, null, false]])
    expect((await lines(t))[0]).toBe('Removed “Dev Reader” from event “Gig”')
    // Only band people can be added.
    await expect(bandOps.updateEvent(t.db, t.member, t.band, { slug: 'gig', fields: { ...fields, people: [t.outsider] } })).rejects.toBeInstanceOf(NotFound)
  })

  it('the participants dialog sets the list right away; only members can, and only band people', async () => {
    const t = await testDb()
    await gig(t)
    expect((await bandOps.listBandPeople(t.db, t.reader, t.band, {})).map((p) => p.email)).toEqual(['member@example.com', 'reader@example.com'])
    await ask(t, t.reader)
    await bandOps.setParticipants(t.db, t.member, t.band, { event: 'gig', people: [t.member] })
    expect(await people(t)).toEqual([['member@example.com', false, null, false]])
    // Added again, the reader starts over: not asked.
    await bandOps.setParticipants(t.db, t.member, t.band, { event: 'gig', people: [t.member, t.reader] })
    expect(await people(t)).toContainEqual(['reader@example.com', false, null, true])
    await expect(bandOps.setParticipants(t.db, t.reader, t.band, { event: 'gig', people: [] })).rejects.toBeInstanceOf(Forbidden)
    await expect(bandOps.setParticipants(t.db, t.member, t.band, { event: 'gig', people: [t.outsider] })).rejects.toBeInstanceOf(NotFound)
  })

  it('a check opens when someone is asked; closed, nobody can answer until it reopens', async () => {
    const t = await testDb()
    await gig(t)
    const state = async () => {
      const a = await bandOps.getAvailability(t.db, t.reader, t.band, { event: 'gig' })
      return [a.open, a.closed]
    }
    expect(await state()).toEqual([false, false])
    const token = (await ask(t, t.reader)).recipients[0].token
    expect(await state()).toEqual([true, false])
    await expect(bandOps.closeAvailability(t.db, t.reader, t.band, { event: 'gig' })).rejects.toBeInstanceOf(Forbidden)
    await bandOps.closeAvailability(t.db, t.member, t.band, { event: 'gig' })
    expect(await state()).toEqual([false, true])
    await expect(bandOps.answerAvailability(t.db, t.reader, t.band, { event: 'gig', answer: 'yes' })).rejects.toThrow('availabilityClosed')
    await expect(answerByToken(t.db, token, { answer: 'yes' })).rejects.toThrow('availabilityClosed')
    expect(await availabilityByToken(t.db, token)).toMatchObject({ closed: true })
    expect(await lines(t)).toContainEqual('Closed the availability request for event “Gig”')
    await bandOps.reopenAvailability(t.db, t.member, t.band, { event: 'gig' })
    expect(await state()).toEqual([true, false])
    await answerByToken(t.db, token, { answer: 'yes' }) // the same link works again
    expect(await lines(t)).toContainEqual('Reopened the availability request for event “Gig”')
    // Asking reopens a closed check too.
    await bandOps.closeAvailability(t.db, t.member, t.band, { event: 'gig' })
    await ask(t)
    expect(await state()).toEqual([true, false])
  })

  it('checking availability asks only people not asked yet', async () => {
    const t = await testDb()
    await gig(t)
    const first = await ask(t)
    expect(first.recipients.map((r) => r.email).sort()).toEqual(['member@example.com', 'reader@example.com'])
    expect(await people(t)).toEqual([
      ['member@example.com', true, null, false],
      ['reader@example.com', true, null, true],
    ])
    expect((await ask(t)).recipients).toEqual([]) // waiting people aren't asked again
    expect(await lines(t)).toContainEqual('Asked availability for event “Gig”')
  })

  it('asks one person at a time, while others wait', async () => {
    const t = await testDb()
    await gig(t)
    expect((await ask(t, t.reader)).recipients.map((r) => r.email)).toEqual(['reader@example.com'])
    await expect(ask(t, t.reader)).rejects.toBeInstanceOf(NotFound) // already waiting
    await expect(ask(t, t.outsider)).rejects.toBeInstanceOf(NotFound)
    expect((await ask(t)).recipients.map((r) => r.email)).toEqual(['member@example.com'])
  })

  it('answers from the emailed link, which reads without writing and can be changed', async () => {
    const t = await testDb()
    await gig(t)
    const token = (await ask(t, t.reader)).recipients[0].token
    await expect(availabilityByToken(t.db, 'nope')).rejects.toBeInstanceOf(NotFound)
    expect(await availabilityByToken(t.db, token)).toMatchObject({ answer: null, stale: false, event: 'Gig' })
    await answerByToken(t.db, token, { answer: 'maybe', note: 'after 9pm' })
    const [change] = await t.db.select().from(changes).where(and(eq(changes.tableName, 'event_people'), sql`${changes.after}->>'answer' = 'maybe'`))
    expect(change.userId).toBe(t.reader) // the audit trail names the person
    await answerByToken(t.db, token, { answer: 'yes', note: 'dropped: only a maybe explains itself' })
    expect(await availabilityByToken(t.db, token)).toMatchObject({ answer: 'yes', note: null })
    await expect(answerByToken(t.db, token, { answer: 'sure' })).rejects.toThrow()
    expect(await lines(t)).toContainEqual('“Dev Reader” answered maybe for event “Gig”')
    await t.db.update(memberships).set({ archivedAt: new Date() }).where(eq(memberships.userId, t.reader))
    await expect(availabilityByToken(t.db, token)).rejects.toBeInstanceOf(NotFound) // left the band
  })

  it('a moved event makes answers stale; those people can be asked again', async () => {
    const t = await testDb()
    await gig(t)
    await ask(t, t.reader)
    await bandOps.answerAvailability(t.db, t.reader, t.band, { event: 'gig', answer: 'no' })
    await t.db.update(events).set({ date: '2031-01-01' }).where(eq(events.slug, 'gig'))
    expect((await bandOps.getAvailability(t.db, t.reader, t.band, { event: 'gig' })).people.find((p) => p.mine)).toMatchObject({ stale: true, answer: 'no' })
    await ask(t, t.reader)
    expect((await bandOps.getAvailability(t.db, t.reader, t.band, { event: 'gig' })).people.find((p) => p.mine)).toMatchObject({ stale: false, answer: null, asked: true })
  })

  it('readers answer only for themselves and cannot ask', async () => {
    const t = await testDb()
    await bandOps.createEvent(t.db, t.member, t.band, { title: 'Gig', date: day(20), people: [t.member] })
    await expect(bandOps.askAvailability(t.db, t.reader, t.band, { event: 'gig' })).rejects.toBeInstanceOf(Forbidden)
    await expect(bandOps.answerAvailability(t.db, t.reader, t.band, { event: 'gig', answer: 'yes' })).rejects.toBeInstanceOf(NotFound) // not on the list
  })

  it('migration 0010 moves everyone asked onto the event with their latest answer', async () => {
    // Migrate to 0009, add old-style checks, then run 0010.
    const { mkdtemp, cp, readFile, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { PGlite } = await import('@electric-sql/pglite')
    const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
    const { drizzle } = await import('drizzle-orm/pglite')
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    const dir = await mkdtemp(`${tmpdir()}/gigg-mig-`)
    await cp('drizzle', dir, { recursive: true })
    const journal = JSON.parse(await readFile(`${dir}/meta/_journal.json`, 'utf8'))
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx < 10)
    await writeFile(`${dir}/meta/_journal.json`, JSON.stringify(journal))
    const client = new PGlite({ extensions: { pg_trgm } })
    onTestFinished(() => client.close())
    const db = drizzle(client)
    await migrate(db, { migrationsFolder: dir })
    await client.exec(`
      insert into users (id, name, email) values
        ('00000000-0000-0000-0000-00000000000a', 'A', 'a@x'), ('00000000-0000-0000-0000-00000000000b', 'B', 'b@x');
      insert into bands (id, slug, name) values ('00000000-0000-0000-0000-0000000000b1', 'b', 'B');
      insert into events (id, band_id, slug, title, date) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'e', 'E', '2030-01-01');
      insert into availability_requests (id, band_id, event_id, date, asked_by, closed_at, created_at) values
        ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', '2029-12-01', '00000000-0000-0000-0000-00000000000a', now(), now() - interval '1 day'),
        ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', '2030-01-01', '00000000-0000-0000-0000-00000000000a', null, now());
      insert into availability_responses (band_id, request_id, user_id, answer, note, token_hash) values
        ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'no', null, 'old-a'),
        ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', 'maybe', 'late', 'old-b'),
        ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', null, null, 'new-a');`)
    await migrate(db, { migrationsFolder: 'drizzle' })
    const { rows } = await client.query('select u.name, p.answer, p.note, p.token_hash, p.asked_for::text from event_people p join users u on u.id = p.user_id order by u.name')
    expect(rows).toEqual([
      { name: 'A', answer: null, note: null, token_hash: 'new-a', asked_for: '2030-01-01' }, // latest check: waiting
      { name: 'B', answer: 'maybe', note: 'late', token_hash: 'old-b', asked_for: '2029-12-01' }, // only in the old one
    ])
  })
})

describe('calendar feed', () => {
  it('one stable link per person; reset kills the old one; leaving the band kills it too', async () => {
    const t = await testDb()
    const { token } = await bandOps.calendarFeed(t.db, t.reader, t.band, {})
    expect((await bandOps.calendarFeed(t.db, t.reader, t.band, {})).token).toBe(token)
    expect((await bandOps.calendarFeed(t.db, t.member, t.band, {})).token).not.toBe(token)
    expect(await calendarByToken(t.db, token)).toMatchObject({ band: { name: 'Demo Band', timeZone: 'Europe/Amsterdam' } })
    const { token: fresh } = await bandOps.resetCalendarFeed(t.db, t.reader, t.band, {})
    await expect(calendarByToken(t.db, token)).rejects.toBeInstanceOf(NotFound)
    await t.db.update(memberships).set({ archivedAt: new Date() }).where(eq(memberships.userId, t.reader))
    await expect(calendarByToken(t.db, fresh)).rejects.toBeInstanceOf(NotFound)
  })

  it('has options and confirmed events from the last year; no leads, cancelled or archived', async () => {
    const t = await testDb()
    const [{ bandId }] = await t.db.select({ bandId: events.bandId }).from(events).where(eq(events.slug, 'summer-party'))
    const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)
    await t.db.insert(events).values([
      { bandId, slug: 'opt', title: 'Opt', date: day(5), bookingStatus: 'option' },
      { bandId, slug: 'lead', title: 'Lead', date: day(5), bookingStatus: 'lead' },
      { bandId, slug: 'gone', title: 'Gone', date: day(5), bookingStatus: 'cancelled' },
      { bandId, slug: 'arch', title: 'Arch', date: day(5), bookingStatus: 'confirmed', archivedAt: new Date() },
      { bandId, slug: 'old', title: 'Old', date: day(-400), bookingStatus: 'confirmed' },
    ])
    const { token } = await bandOps.calendarFeed(t.db, t.member, t.band, {})
    const titles = (await calendarByToken(t.db, token)).events.map((e) => e.title).sort()
    expect(titles).toEqual(['Opt', 'Spring Show', 'Summer Party'])
  })

  it('event times: optional, end needs a start', async () => {
    const t = await testDb()
    const ev = await bandOps.createEvent(t.db, t.member, t.band, { title: 'Late', date: '2031-01-01', startTime: '21:00', endTime: '01:30' })
    expect(ev).toMatchObject({ startTime: '21:00:00', endTime: '01:30:00' })
    expect(await bandOps.createEvent(t.db, t.member, t.band, { title: 'No time', date: '2031-01-01', startTime: '', endTime: '' })).toMatchObject({ startTime: null })
    await expect(bandOps.createEvent(t.db, t.member, t.band, { title: 'X', date: '2031-01-01', endTime: '01:00' })).rejects.toThrow()
    await expect(bandOps.createEvent(t.db, t.member, t.band, { title: 'X', date: '2031-01-01', startTime: '25:00' })).rejects.toThrow()
  })
})

describe('language', () => {
  const setLocale = (t: Awaited<ReturnType<typeof testDb>>, id: string, locale: string) => t.db.update(users).set({ locale }).where(eq(users.id, id))
  const localeOf = async (t: Awaited<ReturnType<typeof testDb>>, email: string) =>
    (await t.db.select({ locale: users.locale }).from(users).where(eq(users.email, email)))[0].locale

  it('writes history in the viewer’s language', async () => {
    const t = await testDb()
    await bandOps.updateSong(t.db, t.member, t.band, { slug: 'closer', fields: { title: 'Big Closer', key: 'A' } })
    await setLocale(t, t.reader, 'nl')
    const [save] = await bandOps.listChanges(t.db, t.reader, t.band, {})
    expect(save.lines).toEqual(['Nummer “Big Closer” gewijzigd: bpm, toonsoort, titel, duur'])
    expect(save.diffs.find((d) => d.field === 'titel')).toMatchObject({ what: 'Nummer “Big Closer”', from: 'Closer', to: 'Big Closer' })
  })

  it('gives a new account the inviter’s language, and leaves an existing account’s alone', async () => {
    const t = await testDb()
    await setLocale(t, t.member, 'nl')
    expect(await bandOps.inviteMember(t.db, t.member, t.band, { email: 'new@example.com', role: 'reader' })).toMatchObject({ locale: 'nl' })
    expect(await localeOf(t, 'new@example.com')).toBe('nl')
    expect(await bandOps.inviteMember(t.db, t.member, t.band, { email: 'reader@example.com', role: 'member' })).toMatchObject({ locale: 'en' })
  })
})
