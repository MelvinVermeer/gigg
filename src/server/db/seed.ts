// Seed data. seed(): the small fixture the tests rely on. seedDemo(): a fuller band for local mode
// (more songs, venues, contacts, events, blocks and setlists). Idempotent: does nothing if a band exists.
import { eq } from 'drizzle-orm'
import type { Db } from './index'
import {
  bands,
  blockSongs,
  blocks,
  contacts,
  eventContacts,
  events,
  memberships,
  setItems,
  setlists,
  sets,
  songs,
  users,
  venues,
} from './schema'

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

export async function seed(db: Db) {
  if ((await db.select({ id: bands.id }).from(bands).limit(1)).length) return false

  const [member, reader] = await db
    .insert(users)
    .values([
      { name: 'Dev Member', email: 'member@example.com', emailVerified: true },
      { name: 'Dev Reader', email: 'reader@example.com', emailVerified: true },
    ])
    .returning()
  const [band] = await db.insert(bands).values({ slug: 'demo-band', name: 'Demo Band' }).returning()
  await db.insert(memberships).values([
    { bandId: band.id, userId: member.id, role: 'member' },
    { bandId: band.id, userId: reader.id, role: 'reader' },
  ])
  await db.insert(songs).values([
    { bandId: band.id, slug: 'opening-song', title: 'Opening Song', durationSec: 210, key: 'E', bpm: 128 },
    { bandId: band.id, slug: 'slow-one', title: 'Slow One', durationSec: 260, key: 'Am', bpm: 72 },
    { bandId: band.id, slug: 'closer', title: 'Closer', durationSec: 300, key: 'G', bpm: 140 },
  ])
  const [venue] = await db
    .insert(venues)
    .values({ bandId: band.id, slug: 'the-local-hall', name: 'The Local Hall', address: 'Main Street 1' })
    .returning()
  const [promoter] = await db
    .insert(contacts)
    .values({ bandId: band.id, name: 'Pat Promoter', email: 'pat@example.com', phone: '+31 6 12345678' })
    .returning()
  const [summer, spring] = await db
    .insert(events)
    .values([
      { bandId: band.id, slug: 'summer-party', title: 'Summer Party', date: daysFromNow(30), venueId: venue.id, bookingStatus: 'confirmed' },
      { bandId: band.id, slug: 'spring-show', title: 'Spring Show', date: daysFromNow(-30), venueId: venue.id, bookingStatus: 'played', paymentStatus: 'paid' },
    ])
    .returning()
  await db.insert(eventContacts).values([
    { bandId: band.id, eventId: summer.id, contactId: promoter.id },
    { bandId: band.id, eventId: spring.id, contactId: promoter.id },
  ])
  return true
}

const extraSongs: [title: string, sec: number, key: string, bpm: number, notes?: string, tuning?: string][] = [
  ['Neon Harbour', 245, 'D', 118],
  ['Paper Lanterns', 212, 'G', 96, 'Capo 2'],
  ['Midnight Freight', 278, 'E', 132],
  ['Salt and Smoke', 301, 'Bm', 84, 'Slow build, drums in at chorus 2'],
  ['Copper Sky', 199, 'A', 124],
  ['Lighthouse Keeper', 266, 'F#m', 76],
  ['Rattle the Windows', 188, 'E', 150, undefined, 'Drop D'],
  ['Last Tram Home', 233, 'C', 108],
  ['Velvet Static', 254, 'Dm', 100],
  ['Gold Teeth', 176, 'A', 140],
  ['Northbound', 290, 'G', 112],
  ['Little Fires', 221, 'Em', 88, 'Singer alone for the first verse'],
  ['Thunder in the Pantry', 205, 'B', 146],
  ['Satellite Heart', 248, 'F', 120],
  ['Old Dog Blues', 312, 'E', 70, 'Long solo: wait for the nod'],
  ['Dancing on the Fault Line', 237, 'C#m', 128],
  ['Wildflower Road', 226, 'G', 104],
  ['Seven Mile Bridge', 284, 'D', 116],
  ['Bones of the City', 241, 'Am', 98],
  ['Encore Machine', 260, 'E', 138, 'Big ending: four hits'],
]

/** Local mode: the test fixture plus a band that feels used. */
export async function seedDemo(db: Db) {
  if (!(await seed(db))) return
  const [band] = await db.select().from(bands).where(eq(bands.slug, 'demo-band'))
  const bandId = band.id
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  await db.insert(songs).values([
    ...extraSongs.map(([title, durationSec, key, bpm, notes, tuning]) => ({
      bandId, slug: slug(title), title, durationSec, key, bpm, notes, tuning,
    })),
    { bandId, slug: 'forgotten-b-side', title: 'Forgotten B-side', durationSec: 200, archivedAt: new Date() },
  ])
  const song = Object.fromEntries((await db.select().from(songs).where(eq(songs.bandId, bandId))).map((s) => [s.title, s.id]))

  const [anchor, meridian, park, cafe, kroeg] = await db
    .insert(venues)
    .values([
      { bandId, slug: 'the-rusty-anchor', name: 'The Rusty Anchor', address: 'Harbour Road 12' },
      { bandId, slug: 'hotel-meridian', name: 'Hotel Meridian', address: 'Boulevard 100', notes: 'Use the service entrance at the back.' },
      { bandId, slug: 'park-stage', name: 'Park Stage', address: 'Parklaan 1' },
      { bandId, slug: 'cafe-central', name: 'Café Central', address: 'Stationsstraat 8' },
      { bandId, slug: 'de-kroeg', name: 'De Kroeg', address: 'Marktplein 3' },
    ])
    .returning()
  const [robin, alex, jamie, chris, taylor, morgan] = await db
    .insert(contacts)
    .values([
      { bandId, name: 'Robin de Vries', organisation: 'De Kroeg', email: 'robin@example.com', phone: '+31 6 22223333' },
      { bandId, name: 'Alex Morgan', organisation: 'Sound & Light Co', email: 'alex@example.com', notes: 'Sound engineer' },
      { bandId, name: 'Jamie Lee', organisation: 'Park Festival', email: 'jamie@example.com' },
      { bandId, name: 'Chris Bakker', organisation: 'Hotel Meridian', phone: '+31 6 44445555' },
      { bandId, name: 'Taylor Kim', organisation: 'Stagefright Booking', email: 'taylor@example.com' },
      { bandId, name: 'Morgan Fox', organisation: 'Café Central', email: 'morgan@example.com' },
    ])
    .returning()

  const ev = (slug: string, title: string, days: number, venueId: string, rest: Partial<typeof events.$inferInsert> = {}) => ({
    bandId, slug, title, date: daysFromNow(days), venueId, ...rest,
  })
  const [friday, wedding, festival, , newYear, autumn, anchorSummer] = await db
    .insert(events)
    .values([
      ev('rusty-anchor-friday', 'Rusty Anchor Friday', 9, anchor.id, { bookingStatus: 'confirmed', notes: 'Doors 21:00, on stage 22:00. Two sets.' }),
      ev('wedding-at-hotel-meridian', 'Wedding at Hotel Meridian', 16, meridian.id, {
        bookingStatus: 'confirmed', paymentStatus: 'invoiced', tags: ['wedding'],
        notes: 'Load-in 16:00, dinner 18:30, first set 21:00. Dress code: black.',
      }),
      ev('park-festival', 'Park Festival', 45, park.id, { bookingStatus: 'option', tags: ['festival'] }),
      ev('cafe-central-sessions', 'Café Central Sessions', 75, cafe.id),
      ev('new-year-at-de-kroeg', 'New Year at De Kroeg', -60, kroeg.id, { bookingStatus: 'played', paymentStatus: 'paid' }),
      ev('cafe-central-autumn', 'Café Central Autumn', -100, cafe.id, { bookingStatus: 'played', paymentStatus: 'paid' }),
      ev('rusty-anchor-summer', 'Rusty Anchor Summer', -140, anchor.id, { bookingStatus: 'played', paymentStatus: 'paid' }),
      ev('rained-out-festival', 'Rained-out Festival', -20, park.id, { bookingStatus: 'cancelled' }),
    ])
    .returning()
  await db.insert(eventContacts).values(
    (
      [
        [friday, alex], [wedding, chris], [wedding, taylor], [festival, jamie], [festival, alex],
        [newYear, robin], [autumn, morgan], [anchorSummer, alex],
      ] as const
    ).map(([e, c]) => ({ bandId, eventId: e.id, contactId: c.id })),
  )

  const run = (titles: string[]) => titles.map((t) => song[t])
  const acoustic = ['Paper Lanterns', 'Little Fires', 'Lighthouse Keeper']
  const encore = ['Encore Machine', 'Closer']
  const openers = ['Opening Song', 'Rattle the Windows', 'Gold Teeth']
  for (const [name, titles] of [['Acoustic bit', acoustic], ['Encore', encore], ['Openers', openers]] as const) {
    const [b] = await db.insert(blocks).values({ bandId, name }).returning()
    await db.insert(blockSongs).values(run([...titles]).map((songId, position) => ({ bandId, blockId: b.id, position, songId })))
  }

  const standard: [string, string[]][] = [
    ['Set 1', [...openers, 'Neon Harbour', 'Midnight Freight', 'Copper Sky', 'Last Tram Home', 'Velvet Static', 'Slow One', 'Northbound']],
    ['Set 2', [...acoustic, 'Salt and Smoke', 'Satellite Heart', 'Thunder in the Pantry', 'Dancing on the Fault Line', 'Seven Mile Bridge', 'Old Dog Blues']],
    ['Encore', encore],
  ]
  const club: [string, string[]][] = [
    ['Set 1', ['Rattle the Windows', 'Neon Harbour', 'Gold Teeth', 'Wildflower Road', 'Bones of the City', 'Midnight Freight', 'Satellite Heart', 'Closer']],
  ]
  const wed: [string, string[]][] = [
    ['Dinner', [...acoustic, 'Wildflower Road', 'Slow One']],
    ['Set 1', ['Opening Song', 'Copper Sky', 'Neon Harbour', 'Last Tram Home', 'Satellite Heart', 'Seven Mile Bridge']],
    ['Set 2', ['Dancing on the Fault Line', 'Gold Teeth', 'Thunder in the Pantry', ...encore]],
  ]
  const addSetlist = async (name: string, content: [string, string[]][], eventId?: string) => {
    const [sl] = await db.insert(setlists).values({ bandId, name, eventId }).returning()
    for (const [position, [setName, titles]] of content.entries()) {
      const [set] = await db.insert(sets).values({ bandId, setlistId: sl.id, position, name: setName }).returning()
      await db.insert(setItems).values(run(titles).map((songId, i) => ({ bandId, setId: set.id, position: i, songId })))
    }
  }
  await addSetlist('Standard 2 sets', standard)
  await addSetlist('Short club set', club)
  await addSetlist(friday.title, standard, friday.id)
  await addSetlist(wedding.title, wed, wedding.id)
  await addSetlist(newYear.title, standard, newYear.id)
  await addSetlist(anchorSummer.title, club, anchorSummer.id)
}
