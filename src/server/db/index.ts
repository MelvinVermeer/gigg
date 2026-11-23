// The app's database: Postgres when DATABASE_URL is set, otherwise local PGlite (dev mode).
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
export { schema }

/** Local mode = no real database configured: PGlite, seed data, emails to the outbox. */
export const isLocal = !process.env.DATABASE_URL

async function connect(): Promise<Db> {
  // Never fall back to demo mode on a real deployment (read-only filesystem, demo accounts).
  if (isLocal && process.env.VERCEL)
    throw new Error('DATABASE_URL is not set. Add a Postgres database to the Vercel project and run the migrations (README: Self-host on Vercel).')
  // Same for any production build: local mode has a public auth secret and demo admin. E2E opts in.
  if (isLocal && process.env.NODE_ENV === 'production' && !process.env.LOCAL_MODE)
    throw new Error('DATABASE_URL is not set. Set it, or LOCAL_MODE=1 to run this build with demo data (never on a public server).')
  if (!isLocal) {
    const { drizzle } = await import('drizzle-orm/node-postgres')
    return drizzle(process.env.DATABASE_URL!, { schema }) as unknown as Db
  }
  const { openPglite } = await import('./pglite')
  const { seedDemo } = await import('./seed')
  const { db } = await openPglite(process.env.PGLITE_DIR ?? '.pglite')
  await seedDemo(db as unknown as Db)
  return db as unknown as Db
}

export const db = await connect()
