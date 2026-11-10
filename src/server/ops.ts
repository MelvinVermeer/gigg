// Band data operations as plain functions: (db, userId, bandSlug, input) → result.
// Server functions (fns.ts) are thin wrappers around these, so everything here is testable without HTTP.
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db'
import {
  bands,
  bookingStatus,
  contacts,
  eventContacts,
  events,
  memberships,
  paymentStatus,
  slugRedirects,
  songs,
  venues,
} from './db/schema'

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

// Slugs --------------------------------------------------------------------

export function slugify(text: string) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'untitled'
}

/** Slugs that collide with fixed routes such as /songs/new and /events/new. */
const reserved = ['new']

function* numbered(base: string) {
  yield base
  for (let i = 2; ; i++) yield `${base}-${i}`
}

/** Events: the title; if taken, the date in front; only then -2, -3. */
function* eventSlugs(title: string, date: string) {
  yield slugify(title)
  yield* numbered(`${date}-${slugify(title)}`)
}

type SlugTable = typeof songs | typeof venues | typeof events

/** First candidate not used by another row of `table` in this band (archived rows keep theirs). */
async function freeSlug(tx: Tx, table: SlugTable, bandId: string, candidates: Iterable<string>, exceptId?: string) {
  for (const slug of candidates) {
    if (reserved.includes(slug)) continue
    const [taken] = await tx
      .select({ id: table.id })
      .from(table as typeof songs)
      .where(and(eq(table.bandId, bandId), eq(table.slug, slug), exceptId ? ne(table.id, exceptId) : undefined))
    if (!taken) return slug
  }
  throw new Error('unreachable')
}

/** Keep the old slug working as a redirect. Re-pointed if another entity used it before. */
async function redirectOldSlug(tx: Tx, bandId: string, type: string, oldSlug: string, entityId: string) {
  await tx
    .insert(slugRedirects)
    .values({ bandId, type, oldSlug, entityId })
    .onConflictDoUpdate({ target: [slugRedirects.bandId, slugRedirects.type, slugRedirects.oldSlug], set: { entityId } })
}

/** Current slug of an entity that used to have `slug`, if any. */
async function movedSlug(tx: Tx, table: typeof songs | typeof events, bandId: string, type: string, slug: string) {
  const [moved] = await tx
    .select({ slug: table.slug })
    .from(slugRedirects)
    .innerJoin(table as typeof songs, eq(table.id, slugRedirects.entityId))
    .where(and(eq(slugRedirects.bandId, bandId), eq(slugRedirects.type, type), eq(slugRedirects.oldSlug, slug)))
  return moved?.slug
}

async function rowBySlug(tx: Tx, table: typeof songs | typeof events, bandId: string, slug: string) {
  const [row] = await tx
    .select({ id: table.id, title: table.title, slug: table.slug })
    .from(table as typeof songs)
    .where(and(eq(table.bandId, bandId), eq(table.slug, slug)))
  if (!row) throw new NotFound()
  return row
}

// Shared input schemas -------------------------------------------------------

/** Optional text field: trimmed, "" becomes null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)

const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .default([])
  .transform((t) => [...new Set(t)])

const bySlug = z.object({ slug: z.string() })

// Songs --------------------------------------------------------------------

const songFields = z.object({
  title: z.string().trim().min(1).max(200),
  durationSec: z
    .number()
    .int()
    .min(0)
    .max(5999)
    .nullish()
    .transform((v) => v ?? null),
  key: optText(12),
  bpm: z
    .number()
    .int()
    .min(20)
    .max(400)
    .nullish()
    .transform((v) => v ?? null),
  tuning: optText(200),
  notes: optText(10_000),
  tags,
})

export type SongFields = z.input<typeof songFields>

const songOps = {
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
    const moved = await movedSlug(tx, songs, bandId, 'song', slug)
    if (moved) return { moved: true as const, slug: moved }
    throw new NotFound()
  }),

  createSong: bandOp('member', songFields, async ({ tx, bandId }, fields) => {
    const slug = await freeSlug(tx, songs, bandId, numbered(slugify(fields.title)))
    const [song] = await tx
      .insert(songs)
      .values({ bandId, slug, ...fields })
      .returning()
    return song
  }),

  /** Update a song. A new title gets a new slug; the old one keeps working as a redirect. */
  updateSong: bandOp('member', bySlug.extend({ fields: songFields }), async ({ tx, bandId }, { slug, fields }) => {
    const old = await rowBySlug(tx, songs, bandId, slug)
    const newSlug =
      slugify(fields.title) === slugify(old.title)
        ? slug
        : await freeSlug(tx, songs, bandId, numbered(slugify(fields.title)), old.id)
    if (newSlug !== slug) await redirectOldSlug(tx, bandId, 'song', slug, old.id)
    const [song] = await tx
      .update(songs)
      .set({ ...fields, slug: newSlug })
      .where(eq(songs.id, old.id))
      .returning()
    return song
  }),

  archiveSong: bandOp('member', bySlug, async ({ tx, bandId }, { slug }) => {
    const { id } = await rowBySlug(tx, songs, bandId, slug)
    await tx.update(songs).set({ archivedAt: new Date() }).where(eq(songs.id, id))
  }),

  restoreSong: bandOp('member', bySlug, async ({ tx, bandId }, { slug }) => {
    const { id } = await rowBySlug(tx, songs, bandId, slug)
    await tx.update(songs).set({ archivedAt: null }).where(eq(songs.id, id))
  }),
}

// Events -------------------------------------------------------------------

/** Pick an existing venue/contact by id, or create a new one inline from the event form. */
const venueRef = z.union([
  z.object({ id: z.uuid() }),
  z.object({ name: z.string().trim().min(1).max(200), address: optText(500) }),
])
const contactRef = z.union([
  z.object({ id: z.uuid() }),
  z.object({ name: z.string().trim().min(1).max(200), email: optText(200), phone: optText(50) }),
])

const eventFields = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.iso.date(),
  venue: venueRef.nullish().transform((v) => v ?? null),
  contacts: z.array(contactRef).max(20).default([]),
  bookingStatus: z.enum(bookingStatus.enumValues).default('lead'),
  paymentStatus: z.enum(paymentStatus.enumValues).default('open'),
  tags,
  notes: optText(10_000),
})

export type EventFields = z.input<typeof eventFields>

/** Resolve venue/contact refs to ids of *this band*, creating new ones. Foreign ids are rejected. */
async function resolveRefs(tx: Tx, bandId: string, fields: z.output<typeof eventFields>) {
  let venueId: string | null = null
  if (fields.venue && 'id' in fields.venue) {
    const [v] = await tx
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, fields.venue.id), eq(venues.bandId, bandId)))
    if (!v) throw new NotFound()
    venueId = v.id
  } else if (fields.venue) {
    const slug = await freeSlug(tx, venues, bandId, numbered(slugify(fields.venue.name)))
    ;[{ id: venueId }] = await tx
      .insert(venues)
      .values({ bandId, slug, ...fields.venue })
      .returning({ id: venues.id })
  }

  const contactIds: string[] = []
  const existing = fields.contacts.flatMap((c) => ('id' in c ? [c.id] : []))
  if (existing.length) {
    const found = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(inArray(contacts.id, existing), eq(contacts.bandId, bandId)))
    if (found.length !== new Set(existing).size) throw new NotFound()
  }
  for (const c of fields.contacts) {
    if ('id' in c) contactIds.push(c.id)
    else contactIds.push((await tx.insert(contacts).values({ bandId, ...c }).returning({ id: contacts.id }))[0].id)
  }
  return { venueId, contactIds: [...new Set(contactIds)] }
}

async function setEventContacts(tx: Tx, bandId: string, eventId: string, contactIds: string[]) {
  await tx.delete(eventContacts).where(eq(eventContacts.eventId, eventId))
  if (contactIds.length)
    await tx.insert(eventContacts).values(contactIds.map((contactId) => ({ bandId, eventId, contactId })))
}

const eventOps = {
  /** Upcoming (today and later, soonest first), past (latest first) or archived. */
  listEvents: bandOp(
    'reader',
    z.object({ when: z.enum(['upcoming', 'past', 'archived']).default('upcoming') }),
    ({ tx, bandId }, { when }) =>
      // ponytail: "today" is the database's date (UTC); pass the viewer's date if bands outside Europe complain.
      tx
        .select({
          slug: events.slug,
          title: events.title,
          date: events.date,
          venue: venues.name,
          bookingStatus: events.bookingStatus,
          paymentStatus: events.paymentStatus,
        })
        .from(events)
        .leftJoin(venues, eq(venues.id, events.venueId))
        .where(
          and(
            eq(events.bandId, bandId),
            when === 'archived' ? isNotNull(events.archivedAt) : isNull(events.archivedAt),
            when === 'upcoming' ? gte(events.date, sql`current_date`) : undefined,
            when === 'past' ? lt(events.date, sql`current_date`) : undefined,
          ),
        )
        .orderBy(when === 'upcoming' ? asc(events.date) : desc(events.date), asc(events.title)),
  ),

  /** An event with its venue and contacts. An old slug returns `{ moved: true, slug }` instead. */
  getEvent: bandOp('reader', bySlug, async ({ tx, bandId }, { slug }) => {
    const [row] = await tx
      .select({ event: events, venue: venues })
      .from(events)
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(and(eq(events.bandId, bandId), eq(events.slug, slug)))
    if (!row) {
      const moved = await movedSlug(tx, events, bandId, 'event', slug)
      if (moved) return { moved: true as const, slug: moved }
      throw new NotFound()
    }
    const eventContactRows = await tx
      .select({ id: contacts.id, name: contacts.name, email: contacts.email, phone: contacts.phone })
      .from(eventContacts)
      .innerJoin(contacts, eq(contacts.id, eventContacts.contactId))
      .where(eq(eventContacts.eventId, row.event.id))
      .orderBy(asc(contacts.name))
    return { moved: false as const, event: row.event, venue: row.venue, contacts: eventContactRows }
  }),

  /** Everything the event form needs: venues and contacts to search, and per venue the contacts used last time. */
  eventFormData: bandOp('member', z.object({}), async ({ tx, bandId }) => {
    const venueRows = await tx
      .select({ id: venues.id, name: venues.name, address: venues.address })
      .from(venues)
      .where(and(eq(venues.bandId, bandId), isNull(venues.archivedAt)))
      .orderBy(asc(venues.name))
    const contactRows = await tx
      .select({ id: contacts.id, name: contacts.name, email: contacts.email, phone: contacts.phone })
      .from(contacts)
      .where(and(eq(contacts.bandId, bandId), isNull(contacts.archivedAt)))
      .orderBy(asc(contacts.name))

    // Latest event with contacts per venue → its contacts.
    const latest = await tx
      .selectDistinctOn([events.venueId], { venueId: events.venueId, eventId: events.id })
      .from(events)
      .where(
        and(
          eq(events.bandId, bandId),
          isNotNull(events.venueId),
          isNull(events.archivedAt),
          sql`exists (select 1 from ${eventContacts} where ${eventContacts.eventId} = ${events.id})`,
        ),
      )
      .orderBy(events.venueId, desc(events.date), desc(events.createdAt))
    const links = latest.length
      ? await tx
          .select({ eventId: eventContacts.eventId, contactId: eventContacts.contactId })
          .from(eventContacts)
          .where(
            inArray(
              eventContacts.eventId,
              latest.map((l) => l.eventId),
            ),
          )
      : []
    const lastContactsByVenue: Record<string, string[]> = {}
    for (const l of latest)
      lastContactsByVenue[l.venueId!] = links.filter((x) => x.eventId === l.eventId).map((x) => x.contactId)

    return { venues: venueRows, contacts: contactRows, lastContactsByVenue }
  }),

  createEvent: bandOp('member', eventFields, async ({ tx, bandId }, fields) => {
    const { venueId, contactIds } = await resolveRefs(tx, bandId, fields)
    const { venue: _v, contacts: _c, ...rest } = fields
    const slug = await freeSlug(tx, events, bandId, eventSlugs(fields.title, fields.date))
    const [event] = await tx
      .insert(events)
      .values({ ...rest, bandId, slug, venueId })
      .returning()
    await setEventContacts(tx, bandId, event.id, contactIds)
    return event
  }),

  /** Update an event. A new title gets a new slug; the old one keeps working as a redirect. */
  updateEvent: bandOp('member', bySlug.extend({ fields: eventFields }), async ({ tx, bandId }, { slug, fields }) => {
    const old = await rowBySlug(tx, events, bandId, slug)
    const { venueId, contactIds } = await resolveRefs(tx, bandId, fields)
    const { venue: _v, contacts: _c, ...rest } = fields
    const newSlug =
      slugify(fields.title) === slugify(old.title)
        ? slug
        : await freeSlug(tx, events, bandId, eventSlugs(fields.title, fields.date), old.id)
    if (newSlug !== slug) await redirectOldSlug(tx, bandId, 'event', slug, old.id)
    const [event] = await tx
      .update(events)
      .set({ ...rest, slug: newSlug, venueId })
      .where(eq(events.id, old.id))
      .returning()
    await setEventContacts(tx, bandId, event.id, contactIds)
    return event
  }),

  archiveEvent: bandOp('member', bySlug, async ({ tx, bandId }, { slug }) => {
    const { id } = await rowBySlug(tx, events, bandId, slug)
    await tx.update(events).set({ archivedAt: new Date() }).where(eq(events.id, id))
  }),

  restoreEvent: bandOp('member', bySlug, async ({ tx, bandId }, { slug }) => {
    const { id } = await rowBySlug(tx, events, bandId, slug)
    await tx.update(events).set({ archivedAt: null }).where(eq(events.id, id))
  }),
}

// All band operations ------------------------------------------------------

/** Every band-scoped operation. The authorisation tests run all of them, so add new ones here. */
export const bandOps = {
  getBand: bandOp('reader', z.object({}), async ({ tx, bandId, role }) => {
    const [band] = await tx
      .select({ slug: bands.slug, name: bands.name })
      .from(bands)
      .where(eq(bands.id, bandId))
    return { ...band, role }
  }),
  ...songOps,
  ...eventOps,
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
