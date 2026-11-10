// Demo data for local mode. Idempotent: does nothing if a band exists.
import type { Db } from './index'
import { bands, memberships, songs, users } from './schema'

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
}
