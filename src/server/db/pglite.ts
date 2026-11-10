// Local Postgres (WASM) for dev mode, E2E and Vitest. Never used when DATABASE_URL is set.
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

const extensions = { pg_trgm }

/** Open (or create) a PGlite database and apply all migrations. No dataDir = in memory. */
export async function openPglite(dataDir?: string) {
  const client = new PGlite({ dataDir, extensions })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: 'drizzle' })
  return { client, db }
}

/** Fresh in-memory copy of an already-migrated database (fast: skips migrations). */
export async function clonePglite(template: PGlite) {
  const client = new PGlite({ loadDataDir: await template.dumpDataDir('none'), extensions })
  return { client, db: drizzle(client, { schema }) }
}
