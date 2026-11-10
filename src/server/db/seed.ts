// Demo data for local mode. Idempotent: does nothing if a band exists.
import type { Db } from './index'
import { bands, contacts, eventContacts, events, memberships, songs, users, venues } from './schema'

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

export async function seed(db: Db) {
  if ((await db.select({ id: bands.id }).from(bands).limit(1)).length) return

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
}
