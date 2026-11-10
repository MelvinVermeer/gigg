// Band data operations as plain functions: (db, userId, bandSlug, input) → result.
// Server functions (fns.ts) are thin wrappers around these, so everything here is testable without HTTP.
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db'
import { bands, memberships, songs } from './db/schema'

export class Forbidden extends Error {
  constructor() {
    super('Forbidden')
  }
}

export type Role = 'reader' | 'member'
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Ctx = { tx: Tx; bandId: string; userId: string; role: Role }

/**
 * A band-scoped operation. Checks membership and role *before* reading the input, then runs
 * in a transaction with the acting user set for the audit trigger.
 */
function bandOp<S extends z.ZodType, O>(
  minRole: Role,
  input: S,
  run: (ctx: Ctx, input: z.infer<S>) => Promise<O>,
) {
  return (db: Db, userId: string, bandSlug: string, rawInput: unknown): Promise<O> =>
    db.transaction(async (tx) => {
      const [m] = await tx
        .select({ bandId: bands.id, role: memberships.role })
        .from(memberships)
        .innerJoin(bands, eq(bands.id, memberships.bandId))
        .where(
          and(
            eq(bands.slug, bandSlug),
            eq(memberships.userId, userId),
            isNull(bands.archivedAt),
            isNull(memberships.archivedAt),
          ),
        )
      if (!m || (minRole === 'member' && m.role !== 'member')) throw new Forbidden()
      await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
      return run({ tx, bandId: m.bandId, userId, role: m.role }, input.parse(rawInput))
    })
}

export function slugify(text: string) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'untitled'
}

/** Every band-scoped operation. The outsider test runs all of them, so add new ones here. */
export const bandOps = {
  getBand: bandOp('reader', z.object({}), async ({ tx, bandId, role }) => {
    const [band] = await tx
      .select({ slug: bands.slug, name: bands.name })
      .from(bands)
      .where(eq(bands.id, bandId))
    return { ...band, role }
  }),

  listSongs: bandOp('reader', z.object({}), ({ tx, bandId }) =>
    tx
      .select({ slug: songs.slug, title: songs.title, durationSec: songs.durationSec, key: songs.key })
      .from(songs)
      .where(and(eq(songs.bandId, bandId), isNull(songs.archivedAt)))
      .orderBy(asc(songs.title)),
  ),

  createSong: bandOp(
    'member',
    z.object({ title: z.string().trim().min(1).max(200) }),
    async ({ tx, bandId }, { title }) => {
      const slug = slugify(title)
      // ponytail: check-then-insert; the unique constraint still guards a race. Add suffixes (-2) when duplicate titles become real.
      const [taken] = await tx
        .select({ id: songs.id })
        .from(songs)
        .where(and(eq(songs.bandId, bandId), eq(songs.slug, slug)))
      if (taken) throw new Error(`A song with slug "${slug}" already exists`)
      const [song] = await tx.insert(songs).values({ bandId, slug, title }).returning()
      return song
    },
  ),
}

/** Bands the user belongs to (not band-scoped, so not in bandOps). */
export function myBands(db: Db, userId: string) {
  return db
    .select({ slug: bands.slug, name: bands.name, role: memberships.role })
    .from(memberships)
    .innerJoin(bands, eq(bands.id, memberships.bandId))
    .where(and(eq(memberships.userId, userId), isNull(bands.archivedAt), isNull(memberships.archivedAt)))
    .orderBy(asc(bands.name))
}
