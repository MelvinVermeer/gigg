import { defineConfig } from 'drizzle-kit'

// `pnpm db:generate` needs no database. `pnpm db:migrate` applies migrations to DATABASE_URL
// (local mode migrates PGlite automatically on start).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
