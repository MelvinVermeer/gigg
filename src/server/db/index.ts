// The app's database: Postgres when DATABASE_URL is set, otherwise local PGlite (dev mode).
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
export { schema }

/** Local mode = no real database configured: PGlite, seed data, emails to the outbox. */
export const isLocal = !process.env.DATABASE_URL

async function connect(): Promise<Db> {
  if (!isLocal) {
    const { drizzle } = await import('drizzle-orm/node-postgres')
    return drizzle(process.env.DATABASE_URL!, { schema }) as unknown as Db
  }
  const { openPglite } = await import('./pglite')
  const { seed } = await import('./seed')
  const { db } = await openPglite(process.env.PGLITE_DIR ?? '.pglite')
  await seed(db as unknown as Db)
  return db as unknown as Db
}

export const db = await connect()
