// Band data operations as plain functions: (db, userId, bandSlug, input) → result.
// Server functions (fns.ts) are thin wrappers around these, so everything here is testable without HTTP.
import { and, asc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db'
import { bands, memberships, slugRedirects, songs } from './db/schema'

export class Forbidden extends Error {
  constructor() {
    super('Forbidden')
  }
}

export class NotFound extends Error {
  constructor() {
    super('Not found')
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
  run: (ctx: Ctx, input: z.output<S>) => Promise<O>,
) {
  const op = (db: Db, userId: string, bandSlug: string, rawInput: unknown): Promise<O> =>
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
  return Object.assign(op, { minRole, input })
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

/** Slugs that collide with fixed routes under /<band>/songs/. */
const reservedSongSlugs = ['new']

/** First free song slug for `title`: base, base-2, base-3, ... (archived songs keep theirs). */
async function freeSongSlug(tx: Tx, bandId: string, title: string, exceptId?: string) {
  const base = slugify(title)
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    if (reservedSongSlugs.includes(slug)) continue
    const [taken] = await tx
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.bandId, bandId), eq(songs.slug, slug), exceptId ? ne(songs.id, exceptId) : undefined))
    if (!taken) return slug
  }
}

/** Optional text field: trimmed, "" becomes null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)

const songFields = z.object({
  title: z.string().trim().min(1).max(200),
  durationSec: z.number().int().min(0).max(5999).nullish().transform((v) => v ?? null),
  key: optText(12),
  bpm: z.number().int().min(20).max(400).nullish().transform((v) => v ?? null),
  tuning: optText(200),
  notes: optText(10_000),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(30)
    .default([])
    .transform((tags) => [...new Set(tags)]),
})

export type SongFields = z.input<typeof songFields>

const bySlug = z.object({ slug: z.string() })

async function songIdBySlug(tx: Tx, bandId: string, slug: string) {
  const [song] = await tx
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.bandId, bandId), eq(songs.slug, slug)))
  if (!song) throw new NotFound()
  return song.id
}

/** Every band-scoped operation. The authorisation tests run all of them, so add new ones here. */
export const bandOps = {
  getBand: bandOp('reader', z.object({}), async ({ tx, bandId, role }) => {
    const [band] = await tx
      .select({ slug: bands.slug, name: bands.name })
      .from(bands)
      .where(eq(bands.id, bandId))
    return { ...band, role }
  }),

  listSongs: bandOp('reader', z.object({ archived: z.boolean().default(false) }), ({ tx, bandId }, { archived }) =>
    tx
      .select({
        slug: songs.slug,
        title: songs.title,
        durationSec: songs.durationSec,
        key: songs.key,
        bpm: songs.bpm,
        tags: songs.tags,
      })
      .from(songs)
      .where(and(eq(songs.bandId, bandId), archived ? isNotNull(songs.archivedAt) : isNull(songs.archivedAt)))
      .orderBy(asc(songs.title)),
  ),

  /** A song by slug. An old slug (song was renamed) returns `{ moved: true, slug }` instead. */
  getSong: bandOp('reader', bySlug, async ({ tx, bandId }, { slug }) => {
    const [song] = await tx
      .select()
      .from(songs)
      .where(and(eq(songs.bandId, bandId), eq(songs.slug, slug)))
    if (song) return { moved: false as const, song }
    const [moved] = await tx
      .select({ slug: songs.slug })
      .from(slugRedirects)
      .innerJoin(songs, eq(songs.id, slugRedirects.entityId))
      .where(and(eq(slugRedirects.bandId, bandId), eq(slugRedirects.type, 'song'), eq(slugRedirects.oldSlug, slug)))
    if (moved) return { moved: true as const, slug: moved.slug }
    throw new NotFound()
  }),

  createSong: bandOp('member', songFields, async ({ tx, bandId }, fields) => {
    const slug = await freeSongSlug(tx, bandId, fields.title)
    const [song] = await tx.insert(songs).values({ bandId, slug, ...fields }).returning()
    return song
  }),

  /** Update a song. A new title gets a new slug; the old one keeps working as a redirect. */
  updateSong: bandOp('member', bySlug.extend({ fields: songFields }), async ({ tx, bandId }, { slug, fields }) => {
    const id = await songIdBySlug(tx, bandId, slug)
    const newSlug = slugify(fields.title) === slugify(slug) ? slug : await freeSongSlug(tx, bandId, fields.title, id)
    if (newSlug !== slug) {
      await tx
        .insert(slugRedirects)
        .values({ bandId, type: 'song', oldSlug: slug, entityId: id })
        .onConflictDoUpdate({
          target: [slugRedirects.bandId, slugRedirects.type, slugRedirects.oldSlug],
          set: { entityId: id },
        })
    }
    const [song] = await tx
      .update(songs)
      .set({ ...fields, slug: newSlug })
      .where(eq(songs.id, id))
      .returning()
    return song
  }),

  archiveSong: bandOp('member', bySlug, async ({ tx, bandId }, { slug }) => {
    await tx
      .update(songs)
      .set({ archivedAt: new Date() })
      .where(eq(songs.id, await songIdBySlug(tx, bandId, slug)))
  }),

  restoreSong: bandOp('member', bySlug, async ({ tx, bandId }, { slug }) => {
    await tx
      .update(songs)
      .set({ archivedAt: null })
      .where(eq(songs.id, await songIdBySlug(tx, bandId, slug)))
  }),
}

export type BandOps = typeof bandOps
export type BandOpName = keyof BandOps

/** Bands the user belongs to (not band-scoped, so not in bandOps). */
export function myBands(db: Db, userId: string) {
  return db
    .select({ slug: bands.slug, name: bands.name, role: memberships.role })
    .from(memberships)
    .innerJoin(bands, eq(bands.id, memberships.bandId))
    .where(and(eq(memberships.userId, userId), isNull(bands.archivedAt), isNull(memberships.archivedAt)))
    .orderBy(asc(bands.name))
}
