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
  eventPeople,
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
      { bandId: band.id, slug: 'summer-party', title: 'Summer Party', date: daysFromNow(30), venueId: venue.id, bookingStatus: 'confirmed', createdBy: member.id },
      { bandId: band.id, slug: 'spring-show', title: 'Spring Show', date: daysFromNow(-30), venueId: venue.id, bookingStatus: 'confirmed', paymentStatus: 'paid', createdBy: member.id },
    ])
    .returning()
  await db.insert(eventContacts).values([
    { bandId: band.id, eventId: summer.id, contactId: promoter.id },
    { bandId: band.id, eventId: spring.id, contactId: promoter.id },
  ])
  // The member is on both (not asked yet), so they show under "Mine".
  await db.insert(eventPeople).values([summer, spring].map((e) => ({ bandId: band.id, eventId: e.id, userId: member.id })))
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

/** 80 Beatles songs, so the repertoire is big enough to scroll and search. */
const beatlesSongs: [title: string, sec: number, key: string, bpm: number][] = [
  ['Help!', 139, 'A', 95],
  ['Yesterday', 125, 'F', 97],
  ['Let It Be', 243, 'C', 72],
  ['Hey Jude', 431, 'F', 74],
  ['Come Together', 259, 'Dm', 82],
  ['Something', 182, 'C', 66],
  ['Here Comes the Sun', 185, 'A', 129],
  ['Get Back', 189, 'A', 122],
  ["Don't Let Me Down", 215, 'E', 65],
  ['I Want to Hold Your Hand', 145, 'G', 130],
  ['She Loves You', 141, 'G', 152],
  ["Can't Buy Me Love", 132, 'C', 110],
  ["A Hard Day's Night", 154, 'G', 138],
  ['Eight Days a Week', 164, 'D', 138],
  ['Ticket to Ride', 190, 'A', 124],
  ['Day Tripper', 168, 'E', 135],
  ['We Can Work It Out', 136, 'D', 110],
  ['Paperback Writer', 138, 'G', 138],
  ['Penny Lane', 180, 'B', 113],
  ['Strawberry Fields Forever', 251, 'Bb', 92],
  ['All You Need Is Love', 227, 'G', 102],
  ['Hello, Goodbye', 207, 'C', 119],
  ['Lady Madonna', 136, 'E', 98],
  ['Revolution', 201, 'A', 135],
  ['Oh! Darling', 206, 'A', 60],
  ['Twist and Shout', 153, 'D', 124],
  ['All My Loving', 127, 'E', 153],
  ['I Saw Her Standing There', 173, 'E', 160],
  ['Please Please Me', 123, 'E', 150],
  ['From Me to You', 116, 'C', 126],
  ['I Feel Fine', 137, 'G', 138],
  ['Nowhere Man', 164, 'G', 112],
  ['Norwegian Wood', 125, 'E', 110],
  ['Michelle', 162, 'F', 112],
  ['In My Life', 148, 'A', 104],
  ['Drive My Car', 147, 'D', 122],
  ['Girl', 153, 'Dm', 100],
  ['Taxman', 159, 'D', 135],
  ['Eleanor Rigby', 126, 'Em', 138],
  ['Got to Get You into My Life', 151, 'C', 123],
  ['Tomorrow Never Knows', 177, 'C', 112],
  ['Good Day Sunshine', 129, 'A', 129],
  ['And Your Bird Can Sing', 121, 'E', 134],
  ['Yellow Submarine', 158, 'G', 110],
  ['With a Little Help from My Friends', 165, 'E', 79],
  ['Lucy in the Sky with Diamonds', 208, 'A', 110],
  ['Getting Better', 168, 'G', 110],
  ['A Day in the Life', 337, 'G', 82],
  ["When I'm Sixty-Four", 157, 'Eb', 140],
  ['Lovely Rita', 162, 'E', 107],
  ['Fixing a Hole', 156, 'C', 110],
  ["She's Leaving Home", 215, 'E', 68],
  ['Being for the Benefit of Mr. Kite!', 157, 'G', 110],
  ["Sgt. Pepper's Lonely Hearts Club Band", 122, 'G', 100],
  ['Magical Mystery Tour', 171, 'C', 132],
  ['I Am the Walrus', 276, 'A', 140],
  ['Back in the U.S.S.R.', 163, 'A', 150],
  ['Dear Prudence', 235, 'D', 140],
  ['Glass Onion', 137, 'A', 100],
  ['Ob-La-Di, Ob-La-Da', 188, 'Bb', 114],
  ['While My Guitar Gently Weeps', 285, 'Am', 116],
  ['Blackbird', 138, 'G', 94],
  ['Helter Skelter', 269, 'E', 140],
  ['Rocky Raccoon', 213, 'C', 90],
  ['Julia', 174, 'D', 108],
  ['Birthday', 162, 'A', 150],
  ['Revolution 1', 248, 'A', 100],
  ["Mother Nature's Son", 168, 'D', 110],
  ['Happiness Is a Warm Gun', 164, 'G', 100],
  ['Across the Universe', 228, 'D', 68],
  ['The Long and Winding Road', 218, 'Eb', 68],
  ['Two of Us', 217, 'G', 110],
  ["I've Got a Feeling", 217, 'D', 132],
  ['One After 909', 174, 'A', 152],
  ["Octopus's Garden", 171, 'C', 90],
  ['Because', 165, 'Am', 68],
  ['Golden Slumbers', 91, 'Eb', 70],
  ['Carry That Weight', 96, 'C', 74],
  ['The End', 140, 'A', 90],
  ['Here, There and Everywhere', 145, 'G', 88],
]

/** Local mode: the test fixture plus a band that feels used. */
export async function seedDemo(db: Db) {
  if (!(await seed(db))) return
  const [band] = await db.select().from(bands).where(eq(bands.slug, 'demo-band'))
  const bandId = band.id
  const [member] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'member@example.com'))
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  await db.insert(songs).values([
    ...extraSongs.map(([title, durationSec, key, bpm, notes, tuning]) => ({
      bandId, slug: slug(title), title, durationSec, key, bpm, notes, tuning,
    })),
    ...beatlesSongs.map(([title, durationSec, key, bpm]) => ({ bandId, slug: slug(title), title, durationSec, key, bpm })),
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
    bandId, slug, title, date: daysFromNow(days), venueId, createdBy: member.id, ...rest,
  })
  const [friday, wedding, festival, , newYear, autumn, anchorSummer] = await db
    .insert(events)
    .values([
      ev('rusty-anchor-friday', 'Rusty Anchor Friday', 9, anchor.id, { bookingStatus: 'confirmed', startTime: '22:00', endTime: '01:00', notes: 'Doors 21:00, on stage 22:00. Two sets.' }),
      ev('wedding-at-hotel-meridian', 'Wedding at Hotel Meridian', 16, meridian.id, {
        bookingStatus: 'confirmed', paymentStatus: 'invoiced', tags: ['wedding'], startTime: '16:00', endTime: '00:30',
        notes: 'Load-in 16:00, dinner 18:30, first set 21:00. Dress code: black.',
      }),
      ev('park-festival', 'Park Festival', 45, park.id, { bookingStatus: 'option', tags: ['festival'] }),
      ev('cafe-central-sessions', 'Café Central Sessions', 75, cafe.id),
      ev('new-year-at-de-kroeg', 'New Year at De Kroeg', -60, kroeg.id, { bookingStatus: 'confirmed', paymentStatus: 'paid' }),
      ev('cafe-central-autumn', 'Café Central Autumn', -100, cafe.id, { bookingStatus: 'confirmed', paymentStatus: 'paid' }),
      ev('rusty-anchor-summer', 'Rusty Anchor Summer', -140, anchor.id, { bookingStatus: 'confirmed', paymentStatus: 'paid' }),
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
  await db.insert(eventPeople).values(
    (await db.select({ id: events.id }).from(events).where(eq(events.bandId, bandId))).map((e) => ({ bandId, eventId: e.id, userId: member.id })),
  ).onConflictDoNothing()

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
