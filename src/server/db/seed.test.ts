import { expect, it } from 'vitest'
import type { Db } from './index'
import { openPglite } from './pglite'
import { seedDemo } from './seed'
import { bandOps } from '../ops'
import { users } from './schema'

it('the demo seed loads and reads back through the normal operations', async () => {
  const db = (await openPglite()).db as unknown as Db
  await seedDemo(db)
  await seedDemo(db) // idempotent
  const [member] = await db.select().from(users).limit(1)
  expect(await bandOps.listSongs(db, member.id, 'demo-band', {})).toHaveLength(23)
  expect((await bandOps.listSetlists(db, member.id, 'demo-band', {})).map((s) => s.name)).toEqual(['Short club set', 'Standard 2 sets'])
  const upcoming = await bandOps.listEvents(db, member.id, 'demo-band', {})
  expect(upcoming.slice(0, 3).map((e) => e.title)).toEqual(['Rusty Anchor Friday', 'Wedding at Hotel Meridian', 'Summer Party'])
  const wedding = await bandOps.getSetlist(db, member.id, 'demo-band', { event: 'wedding-at-hotel-meridian' })
  expect(wedding.sets.map((s) => s.name)).toEqual(['Dinner', 'Set 1', 'Set 2'])
})
