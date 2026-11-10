import { and, eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { bands, changes, contacts, memberships, venues } from './db/schema'
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

it('slugify', () => {
  expect(slugify('A Day in the Life')).toBe('a-day-in-the-life')
  expect(slugify('  Café   Olé!! ')).toBe('cafe-ole')
  expect(slugify('!!!')).toBe('untitled')
})
