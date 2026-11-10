// Vitest helper: a fresh, migrated, seeded in-memory Postgres per test.
import type { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { onTestFinished } from 'vitest'
import type { Db } from './db'
import { clonePglite, openPglite } from './db/pglite'
import { users } from './db/schema'
import { seed } from './db/seed'

let template: PGlite | undefined

export async function testDb() {
  if (!template) {
    const { client, db } = await openPglite()
    await seed(db as unknown as Db)
    template = client
  }
  const clone = await clonePglite(template)
  // Each clone is a whole Postgres in WASM; without closing, a run peaks at ~6 GB (too much for CI).
  onTestFinished(() => clone.client.close())
  const db = clone.db as unknown as Db
  const userId = async (email: string) =>
    (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0].id
  return {
    db,
    band: 'demo-band',
    member: await userId('member@example.com'),
    reader: await userId('reader@example.com'),
    outsider: (await db.insert(users).values({ name: 'Outsider', email: 'outsider@example.com' }).returning())[0].id,
  }
}
