// Band data operations as plain functions: (db, userId, bandSlug, input) → result.
// Server functions (fns.ts) are thin wrappers around these, so everything here is testable without HTTP.
import { createHash, randomBytes } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { formatDuration } from '#/lib/duration'
import type { Db } from './db'
import {
  availabilityAnswer,
  availabilityRequests,
  availabilityResponses,
  bands,
  blockSongs,
  blocks,
  bookingStatus,
  changes,
  contacts,
  eventContacts,
  events,
  feedback,
  files,
  memberships,
  paymentStatus,
  role,
  setItems,
  setlists,
  sets,
  slugRedirects,
  songs,
  users,
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
  /** readOnly: Postgres rejects any write, so reads can safely be served over GET. */
  const op = (db: Db, userId: string, bandSlug: string, rawInput: unknown, readOnly = false): Promise<O> =>
    db.transaction(async (tx) => {
      if (readOnly) await tx.execute(sql`set transaction read only`)
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

// Files --------------------------------------------------------------------

/** The bytes go through the storage module (routes/api/files); these only keep the records. */
export const maxFileNameLength = 200

function filesOf(tx: Tx, owner: 'song' | 'event', ownerId: string) {
  return tx
    .select({ id: files.id, name: files.name, contentType: files.contentType, sizeBytes: files.sizeBytes, createdAt: files.createdAt })
    .from(files)
    .where(and(eq(files[owner === 'song' ? 'songId' : 'eventId'], ownerId), isNull(files.archivedAt)))
    .orderBy(asc(files.createdAt))
}

const fileOps = {
  /** Record an uploaded file on a song or an event (exactly one of the two slugs). */
  addFile: bandOp(
    'member',
    z
      .object({
        song: z.string().optional(),
        event: z.string().optional(),
        name: z.string().trim().min(1).max(maxFileNameLength),
        contentType: z.string().trim().min(1).max(200),
        sizeBytes: z.number().int().min(0).max(100 * 1024 * 1024),
        blobPath: z.string().regex(/^[0-9a-f-]{36}$/),
      })
      .refine((v) => !!v.song !== !!v.event, 'A file belongs to a song or an event'),
    async ({ tx, bandId, userId }, { song, event, ...file }) => {
      const owner = song
        ? { songId: (await rowBySlug(tx, songs, bandId, song)).id }
        : { eventId: (await rowBySlug(tx, events, bandId, event!)).id }
      const [row] = await tx
        .insert(files)
        .values({ bandId, uploadedBy: userId, ...owner, ...file })
        .returning({ id: files.id, name: files.name })
      return row
    },
  ),

  archiveFile: bandOp('member', z.object({ id: z.uuid() }), async ({ tx, bandId }, { id }) => {
    const [row] = await tx
      .update(files)
      .set({ archivedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.bandId, bandId), isNull(files.archivedAt)))
      .returning({ id: files.id })
    if (!row) throw new NotFound()
  }),
}

/** For the download route (not band-scoped): the file, if the user is in its band. */
export async function fileForDownload(db: Db, userId: string, id: string) {
  const [file] = await db
    .select({ blobPath: files.blobPath, name: files.name, contentType: files.contentType })
    .from(files)
    .innerJoin(memberships, and(eq(memberships.bandId, files.bandId), eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .where(and(eq(files.id, id), isNull(files.archivedAt)))
  if (!file) throw new NotFound()
  return file
}

// Feedback -----------------------------------------------------------------

const feedbackOps = {
  /** Anyone in the band, readers included, can send feedback to the instance admin. */
  sendFeedback: bandOp('reader', z.object({ body: z.string().trim().min(1).max(5000) }), async ({ tx, bandId, userId }, { body }) => {
    await tx.insert(feedback).values({ bandId, userId, body })
  }),
}

// Members ------------------------------------------------------------------

const memberOps = {
  listMembers: bandOp('member', z.object({}), ({ tx, bandId }) =>
    tx
      .select({ email: users.email, name: users.name, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.bandId, bandId), isNull(memberships.archivedAt)))
      .orderBy(asc(users.email)),
  ),

  /**
   * Add someone by email as reader or member (invitation only: this creates their account).
   * Inviting someone already in the band changes their role. The caller sends the mail (fns.ts).
   */
  inviteMember: bandOp(
    'member',
    z.object({ email: z.string().trim().toLowerCase().email().max(200), role: z.enum(role.enumValues) }),
    async ({ tx, bandId }, { email, role }) => {
      await tx.insert(users).values({ name: '', email }).onConflictDoNothing()
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
      await tx
        .insert(memberships)
        .values({ bandId, userId: user.id, role })
        .onConflictDoUpdate({ target: [memberships.bandId, memberships.userId], set: { role, archivedAt: null } })
      const [band] = await tx.select({ name: bands.name }).from(bands).where(eq(bands.id, bandId))
      return { email, role, bandName: band.name }
    },
  ),

  /** Archive the membership; they can be invited again. You can't remove yourself, so a band is never left empty. */
  removeMember: bandOp('member', z.object({ email: z.string().trim().toLowerCase() }), async ({ tx, bandId, userId }, { email }) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (!user) throw new NotFound()
    if (user.id === userId) throw new Error('You cannot remove yourself')
    const [row] = await tx
      .update(memberships)
      .set({ archivedAt: new Date() })
      .where(and(eq(memberships.bandId, bandId), eq(memberships.userId, user.id), isNull(memberships.archivedAt)))
      .returning({ userId: memberships.userId })
    if (!row) throw new NotFound()
  }),
}

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
        id: songs.id,
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
    if (song) return { moved: false as const, song, files: await filesOf(tx, 'song', song.id) }
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
  // Only touch links that changed: rewriting them all would show up in history as a contact change.
  await tx
    .delete(eventContacts)
    .where(and(eq(eventContacts.eventId, eventId), contactIds.length ? notInArray(eventContacts.contactId, contactIds) : undefined))
  if (contactIds.length)
    await tx
      .insert(eventContacts)
      .values(contactIds.map((contactId) => ({ bandId, eventId, contactId })))
      .onConflictDoNothing()
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
    const [setlist] = await tx
      .select({
        songs: sql<number>`count(*)::int`,
        durationSec: sql<number>`coalesce(sum(songs.duration_sec), 0)::int`,
      })
      .from(setItems)
      .innerJoin(sets, eq(sets.id, setItems.setId))
      .innerJoin(setlists, eq(setlists.id, sets.setlistId))
      .innerJoin(songs, eq(songs.id, setItems.songId))
      .where(row.event.setlistId ? eq(setlists.id, row.event.setlistId) : eq(setlists.eventId, row.event.id))
    return {
      moved: false as const,
      event: row.event,
      venue: row.venue,
      contacts: eventContactRows,
      setlist,
      standardName: row.event.setlistId ? (await setlistById(tx, bandId, row.event.setlistId)).name : null,
      files: await filesOf(tx, 'event', row.event.id),
    }
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
          sql`exists (select 1 from event_contacts where event_contacts.event_id = events.id)`,
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

    // Standalone setlists a new event can start from.
    const setlistRows = await tx
      .select({ id: setlists.id, name: setlists.name })
      .from(setlists)
      .where(and(eq(setlists.bandId, bandId), isNull(setlists.eventId), isNull(setlists.archivedAt)))
      .orderBy(asc(setlists.name))

    return { venues: venueRows, contacts: contactRows, lastContactsByVenue, setlists: setlistRows }
  }),

  /** Create an event; `setlistStandard` uses that standard setlist, `setlistFrom` starts its own setlist as a copy. */
  createEvent: bandOp('member', eventFields.extend({ setlistFrom: z.uuid().nullish(), setlistStandard: z.uuid().nullish() }), async ({ tx, bandId }, fields) => {
    const { venueId, contactIds } = await resolveRefs(tx, bandId, fields)
    const { venue: _v, contacts: _c, setlistFrom, setlistStandard, ...rest } = fields
    const slug = await freeSlug(tx, events, bandId, eventSlugs(fields.title, fields.date))
    const [event] = await tx
      .insert(events)
      .values({ ...rest, bandId, slug, venueId })
      .returning()
    await setEventContacts(tx, bandId, event.id, contactIds)
    if (setlistStandard) await linkStandard(tx, bandId, event.id, setlistStandard)
    else if (setlistFrom) await copySets(tx, bandId, await eventSetlistId(tx, bandId, event), setlistFrom)
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

// Venues & contacts (edited from band settings) ------------------------------

const byId = z.object({ id: z.uuid() })

const venueFields = z.object({
  name: z.string().trim().min(1).max(200),
  address: optText(500),
  notes: optText(10_000),
})

const contactFields = z.object({
  name: z.string().trim().min(1).max(200),
  organisation: optText(200),
  email: optText(200),
  phone: optText(50),
  notes: optText(10_000),
})

export type VenueFields = z.input<typeof venueFields>
export type ContactFields = z.input<typeof contactFields>

/** Update/archive/restore only rows of this band; another band's id is NotFound. */
async function updateOwn(tx: Tx, table: typeof venues | typeof contacts, bandId: string, id: string, set: object) {
  const rows = await tx
    .update(table as typeof venues)
    .set(set)
    .where(and(eq(table.id, id), eq(table.bandId, bandId)))
    .returning({ id: table.id })
  if (!rows.length) throw new NotFound()
}

const venueContactOps = {
  /** All venues, active first, with how many events use each. */
  listVenues: bandOp('reader', z.object({ archived: z.boolean().default(false) }), ({ tx, bandId }, { archived }) =>
    tx
      .select({
        id: venues.id,
        name: venues.name,
        address: venues.address,
        notes: venues.notes,
        archivedAt: venues.archivedAt,
        // Table-qualified on purpose: Drizzle renders columns unqualified inside sql``, which would
        // compare events.venue_id with events.id.
        events: sql<number>`(select count(*)::int from events where events.venue_id = venues.id)`,
      })
      .from(venues)
      .where(and(eq(venues.bandId, bandId), archived ? isNotNull(venues.archivedAt) : isNull(venues.archivedAt)))
      .orderBy(asc(venues.name)),
  ),

  updateVenue: bandOp('member', byId.extend({ fields: venueFields }), ({ tx, bandId }, { id, fields }) =>
    updateOwn(tx, venues, bandId, id, fields),
  ),
  archiveVenue: bandOp('member', byId, ({ tx, bandId }, { id }) =>
    updateOwn(tx, venues, bandId, id, { archivedAt: new Date() }),
  ),
  restoreVenue: bandOp('member', byId, ({ tx, bandId }, { id }) =>
    updateOwn(tx, venues, bandId, id, { archivedAt: null }),
  ),

  /** All contacts, active first, with how many events they're linked to. */
  listContacts: bandOp('reader', z.object({ archived: z.boolean().default(false) }), ({ tx, bandId }, { archived }) =>
    tx
      .select({
        id: contacts.id,
        name: contacts.name,
        organisation: contacts.organisation,
        email: contacts.email,
        phone: contacts.phone,
        notes: contacts.notes,
        archivedAt: contacts.archivedAt,
        events: sql<number>`(select count(*)::int from event_contacts where event_contacts.contact_id = contacts.id)`,
      })
      .from(contacts)
      .where(and(eq(contacts.bandId, bandId), archived ? isNotNull(contacts.archivedAt) : isNull(contacts.archivedAt)))
      .orderBy(asc(contacts.name)),
  ),

  updateContact: bandOp('member', byId.extend({ fields: contactFields }), ({ tx, bandId }, { id, fields }) =>
    updateOwn(tx, contacts, bandId, id, fields),
  ),
  archiveContact: bandOp('member', byId, ({ tx, bandId }, { id }) =>
    updateOwn(tx, contacts, bandId, id, { archivedAt: new Date() }),
  ),
  restoreContact: bandOp('member', byId, ({ tx, bandId }, { id }) =>
    updateOwn(tx, contacts, bandId, id, { archivedAt: null }),
  ),
}

// Setlists & blocks ----------------------------------------------------------

const songIds = z.array(z.uuid()).max(100)
const setsInput = z
  .array(z.object({ name: z.string().trim().min(1).max(60), songIds }))
  .max(10)

/** Song ids must belong to this band (archived songs are fine: old setlists keep them). */
async function assertOwnSongs(tx: Tx, bandId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  if (!unique.length) return
  const found = await tx
    .select({ id: songs.id })
    .from(songs)
    .where(and(inArray(songs.id, unique), eq(songs.bandId, bandId)))
  if (found.length !== unique.length) throw new NotFound()
}

const songSummary = { id: songs.id, slug: songs.slug, title: songs.title, key: songs.key, durationSec: songs.durationSec }

async function eventBySlug(tx: Tx, bandId: string, slug: string) {
  const [ev] = await tx
    .select({ id: events.id, slug: events.slug, title: events.title, date: events.date, setlistId: events.setlistId })
    .from(events)
    .where(and(eq(events.bandId, bandId), eq(events.slug, slug)))
  if (!ev) throw new NotFound()
  return ev
}

/** A setlist's sets, each with its songs in order. */
async function readSets(tx: Tx, setlistId: string | undefined) {
  if (!setlistId) return []
  const setRows = await tx
    .select({ id: sets.id, name: sets.name })
    .from(sets)
    .where(eq(sets.setlistId, setlistId))
    .orderBy(asc(sets.position))
  if (!setRows.length) return []
  const items = await tx
    // Notes/BPM/tuning too: show mode reads the same setlist.
    .select({ setId: setItems.setId, ...songSummary, bpm: songs.bpm, tuning: songs.tuning, notes: songs.notes })
    .from(setItems)
    .innerJoin(songs, eq(songs.id, setItems.songId))
    .where(
      inArray(
        setItems.setId,
        setRows.map((r) => r.id),
      ),
    )
    .orderBy(asc(setItems.position))
  return setRows.map((set) => ({
    name: set.name,
    songs: items.filter((i) => i.setId === set.id).map(({ setId: _, ...song }) => song),
  }))
}

/** The event's setlist id, created (empty) on first use: one setlist per event. */
async function eventSetlistId(tx: Tx, bandId: string, ev: { id: string; title: string }) {
  const [found] = await tx.select({ id: setlists.id }).from(setlists).where(eq(setlists.eventId, ev.id))
  if (found) return found.id
  const [created] = await tx.insert(setlists).values({ bandId, eventId: ev.id, name: ev.title }).returning({ id: setlists.id })
  return created.id
}

/** Use a standard (standalone) setlist as is, or with null go back to the event's own. */
async function linkStandard(tx: Tx, bandId: string, eventId: string, setlistId: string | null) {
  if (setlistId) {
    const row = await setlistById(tx, bandId, setlistId)
    if (row.eventId) throw new NotFound()
  }
  await tx.update(events).set({ setlistId }).where(eq(events.id, eventId))
}

/** A setlist of this band by id (standalone or an event's). */
async function setlistById(tx: Tx, bandId: string, id: string) {
  const [row] = await tx
    .select({ id: setlists.id, name: setlists.name, eventId: setlists.eventId, archivedAt: setlists.archivedAt })
    .from(setlists)
    .where(and(eq(setlists.id, id), eq(setlists.bandId, bandId)))
  if (!row) throw new NotFound()
  return row
}

/** Replace a setlist's sets with `input`. */
async function writeSets(tx: Tx, bandId: string, setlistId: string, input: { name: string; songIds: string[] }[]) {
  await assertOwnSongs(
    tx,
    bandId,
    input.flatMap((s) => s.songIds),
  )
  const old = await tx.select({ id: sets.id }).from(sets).where(eq(sets.setlistId, setlistId))
  if (old.length) {
    await tx.delete(setItems).where(
      inArray(
        setItems.setId,
        old.map((o) => o.id),
      ),
    )
    await tx.delete(sets).where(eq(sets.setlistId, setlistId))
  }
  for (const [position, s] of input.entries()) {
    const [set] = await tx
      .insert(sets)
      .values({ bandId, setlistId, position, name: s.name })
      .returning({ id: sets.id })
    if (s.songIds.length)
      await tx
        .insert(setItems)
        .values(s.songIds.map((songId, i) => ({ bandId, setId: set.id, position: i, songId })))
  }
}

/** Copy setlist `from`'s sets into setlist `to`, replacing what's there. */
async function copySets(tx: Tx, bandId: string, to: string, from: string) {
  await setlistById(tx, bandId, from)
  const source = await readSets(tx, from)
  await writeSets(tx, bandId, to, source.map((s) => ({ name: s.name, songIds: s.songs.map((song) => song.id) })))
}

async function readBlocks(tx: Tx, bandId: string, archived: boolean) {
  const blockRows = await tx
    .select({ id: blocks.id, name: blocks.name, archivedAt: blocks.archivedAt })
    .from(blocks)
    .where(and(eq(blocks.bandId, bandId), archived ? isNotNull(blocks.archivedAt) : isNull(blocks.archivedAt)))
    .orderBy(sql`${blocks.archivedAt} is not null`, asc(blocks.name))
  const items = blockRows.length
    ? await tx
        .select({ blockId: blockSongs.blockId, ...songSummary })
        .from(blockSongs)
        .innerJoin(songs, eq(songs.id, blockSongs.songId))
        .where(
          inArray(
            blockSongs.blockId,
            blockRows.map((b) => b.id),
          ),
        )
        .orderBy(asc(blockSongs.position))
    : []
  return blockRows.map((b) => ({
    ...b,
    songs: items.filter((i) => i.blockId === b.id).map(({ blockId: _, ...song }) => song),
  }))
}

/** Songs that can be added to a set or block (not archived). */
const repertoire = (tx: Tx, bandId: string) =>
  tx
    .select(songSummary)
    .from(songs)
    .where(and(eq(songs.bandId, bandId), isNull(songs.archivedAt)))
    .orderBy(asc(songs.title))

/** Everything the setlist builder needs besides the sets: repertoire, blocks, setlists to copy from. */
async function builderData(tx: Tx, bandId: string, exceptSetlistId: string | undefined) {
  const copyFrom = await tx
    .select({ id: setlists.id, name: setlists.name, date: events.date })
    .from(setlists)
    .leftJoin(events, eq(events.id, setlists.eventId))
    .where(
      and(
        eq(setlists.bandId, bandId),
        exceptSetlistId ? ne(setlists.id, exceptSetlistId) : undefined,
        isNull(setlists.archivedAt),
        sql`exists (select 1 from sets where sets.setlist_id = setlists.id)`,
      ),
    )
    // Standalone setlists first (by name), then events, latest first.
    .orderBy(sql`${events.date} is not null`, desc(events.date), asc(setlists.name))
  return { songs: await repertoire(tx, bandId), blocks: await readBlocks(tx, bandId, false), copyFrom }
}

const setlistTarget = z.union([z.object({ event: z.string() }), z.object({ setlist: z.uuid() })])

/** The setlist id for a target, creating an event's setlist on first use. Standalone ones must exist. */
async function targetId(tx: Tx, bandId: string, target: z.output<typeof setlistTarget>) {
  if ('event' in target) return eventSetlistId(tx, bandId, await eventBySlug(tx, bandId, target.event))
  const row = await setlistById(tx, bandId, target.setlist)
  if (row.eventId) throw new NotFound() // event setlists are addressed through their event
  return row.id
}

const setlistOps = {
  /** An event's setlist plus what the builder needs. */
  getSetlist: bandOp('reader', z.object({ event: z.string() }), async ({ tx, bandId }, { event }) => {
    const ev = await eventBySlug(tx, bandId, event)
    const [own] = await tx.select({ id: setlists.id }).from(setlists).where(eq(setlists.eventId, ev.id))
    const standard = ev.setlistId ? await setlistById(tx, bandId, ev.setlistId) : null
    const standards = await tx
      .select({ id: setlists.id, name: setlists.name })
      .from(setlists)
      .where(and(eq(setlists.bandId, bandId), isNull(setlists.eventId), isNull(setlists.archivedAt)))
      .orderBy(asc(setlists.name))
    return {
      event: ev,
      standard: standard && { id: standard.id, name: standard.name },
      standards,
      sets: await readSets(tx, standard?.id ?? own?.id),
      ...(await builderData(tx, bandId, own?.id)),
    }
  }),

  /** Use a standard setlist as is. */
  useStandardSetlist: bandOp('member', z.object({ event: z.string(), setlist: z.uuid() }), async ({ tx, bandId }, { event, setlist }) => {
    await linkStandard(tx, bandId, (await eventBySlug(tx, bandId, event)).id, setlist)
  }),

  /** Switch to a custom setlist: a copy of `from` (default: the standard in use), or what the event already had. */
  useCustomSetlist: bandOp('member', z.object({ event: z.string(), from: z.uuid().nullish() }), async ({ tx, bandId }, { event, from }) => {
    const ev = await eventBySlug(tx, bandId, event)
    const source = from ?? ev.setlistId
    await linkStandard(tx, bandId, ev.id, null)
    if (source) await copySets(tx, bandId, await eventSetlistId(tx, bandId, ev), source)
  }),

  /** Standalone setlists (not tied to an event): templates to start events from. */
  listSetlists: bandOp('reader', z.object({ archived: z.boolean().default(false) }), async ({ tx, bandId }, { archived }) =>
    tx
      .select({
        id: setlists.id,
        name: setlists.name,
        archivedAt: setlists.archivedAt,
        songs: sql<number>`(select count(*)::int from set_items join sets on sets.id = set_items.set_id where sets.setlist_id = setlists.id)`,
        durationSec: sql<number>`(select coalesce(sum(songs.duration_sec), 0)::int from set_items join sets on sets.id = set_items.set_id join songs on songs.id = set_items.song_id where sets.setlist_id = setlists.id)`,
      })
      .from(setlists)
      .where(and(eq(setlists.bandId, bandId), isNull(setlists.eventId), archived ? isNotNull(setlists.archivedAt) : isNull(setlists.archivedAt)))
      .orderBy(asc(setlists.name)),
  ),

  /** A standalone setlist plus what the builder needs. */
  getStandaloneSetlist: bandOp('reader', byId, async ({ tx, bandId }, { id }) => {
    const setlist = await setlistById(tx, bandId, id)
    if (setlist.eventId) throw new NotFound()
    return { setlist, sets: await readSets(tx, id), ...(await builderData(tx, bandId, id)) }
  }),

  createSetlist: bandOp(
    'member',
    z.object({ name: z.string().trim().min(1).max(60), from: z.uuid().optional() }),
    async ({ tx, bandId }, { name, from }) => {
      const [row] = await tx.insert(setlists).values({ bandId, name }).returning({ id: setlists.id })
      if (from) await copySets(tx, bandId, row.id, from)
      return row
    },
  ),

  renameSetlist: bandOp('member', byId.extend({ name: z.string().trim().min(1).max(60) }), async ({ tx, bandId }, { id, name }) => {
    await targetId(tx, bandId, { setlist: id })
    await tx.update(setlists).set({ name }).where(eq(setlists.id, id))
  }),

  archiveSetlist: bandOp('member', byId, async ({ tx, bandId }, { id }) => {
    await targetId(tx, bandId, { setlist: id })
    await tx.update(setlists).set({ archivedAt: new Date() }).where(eq(setlists.id, id))
  }),

  restoreSetlist: bandOp('member', byId, async ({ tx, bandId }, { id }) => {
    await targetId(tx, bandId, { setlist: id })
    await tx.update(setlists).set({ archivedAt: null }).where(eq(setlists.id, id))
  }),

  saveSetlist: bandOp('member', z.intersection(setlistTarget, z.object({ sets: setsInput })), async ({ tx, bandId }, input) => {
    await writeSets(tx, bandId, await targetId(tx, bandId, input), input.sets)
  }),

  /** Copy another setlist (standalone or an event's) into this one, replacing what's there. */
  copySetlist: bandOp('member', z.intersection(setlistTarget, z.object({ from: z.uuid() })), async ({ tx, bandId }, input) => {
    await copySets(tx, bandId, await targetId(tx, bandId, input), input.from)
  }),

  listBlocks: bandOp('reader', z.object({ archived: z.boolean().default(false) }), async ({ tx, bandId }, { archived }) => ({
    blocks: await readBlocks(tx, bandId, archived),
    songs: await repertoire(tx, bandId),
  })),

  /** Create (no id) or update a block: a reusable run of songs, copied into sets when used. */
  saveBlock: bandOp(
    'member',
    z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(60), songIds }),
    async ({ tx, bandId }, { id, name, songIds: ids }) => {
      await assertOwnSongs(tx, bandId, ids)
      let blockId = id
      if (blockId) {
        const rows = await tx
          .update(blocks)
          .set({ name })
          .where(and(eq(blocks.id, blockId), eq(blocks.bandId, bandId)))
          .returning({ id: blocks.id })
        if (!rows.length) throw new NotFound()
        await tx.delete(blockSongs).where(eq(blockSongs.blockId, blockId))
      } else {
        ;[{ id: blockId }] = await tx.insert(blocks).values({ bandId, name }).returning({ id: blocks.id })
      }
      if (ids.length)
        await tx.insert(blockSongs).values(ids.map((songId, position) => ({ bandId, blockId: blockId!, position, songId })))
      return { id: blockId }
    },
  ),

  archiveBlock: bandOp('member', byId, async ({ tx, bandId }, { id }) => {
    const rows = await tx
      .update(blocks)
      .set({ archivedAt: new Date() })
      .where(and(eq(blocks.id, id), eq(blocks.bandId, bandId)))
      .returning({ id: blocks.id })
    if (!rows.length) throw new NotFound()
  }),

  restoreBlock: bandOp('member', byId, async ({ tx, bandId }, { id }) => {
    const rows = await tx
      .update(blocks)
      .set({ archivedAt: null })
      .where(and(eq(blocks.id, id), eq(blocks.bandId, bandId)))
      .returning({ id: blocks.id })
    if (!rows.length) throw new NotFound()
  }),
}

// Search ---------------------------------------------------------------------

export type SearchResult = {
  type: 'song' | 'event' | 'venue' | 'contact'
  /** Slug (songs, events) or id (venues, contacts): what the link needs. */
  ref: string
  label: string
  detail: string | null
}

const searchOps = {
  /**
   * Fuzzy search across songs, events (also by venue name), venues and contacts. Substring matches
   * (ILIKE) plus typo tolerance (pg_trgm word_similarity, `<%`); best matches first. Archived items
   * are left out. Columns are table-qualified on purpose (see listVenues).
   */
  search: bandOp('reader', z.object({ q: z.string().trim().max(100) }), async ({ tx, bandId }, { q }) => {
    if (!q) return []
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const matches = (text: ReturnType<typeof sql>) => sql`(${text} ilike ${like} or ${q} <% ${text})`
    const score = (text: ReturnType<typeof sql>) =>
      sql`(case when ${text} ilike ${like} then 1 else 0 end + word_similarity(${q}, ${text}))`
    const eventText = sql`concat_ws(' ', events.title, venues.name)`
    const contactText = sql`concat_ws(' ', contacts.name, contacts.organisation, contacts.email)`
    const venueText = sql`concat_ws(' ', venues.name, venues.address)`
    const { rows } = (await tx.execute(sql`
      select 'song' as type, songs.slug as ref, songs.title as label, songs.key as detail, ${score(sql`songs.title`)} as score
        from songs
        where songs.band_id = ${bandId} and songs.archived_at is null and ${matches(sql`songs.title`)}
      union all
      select 'event', events.slug, events.title, concat_ws(' · ', to_char(events.date, 'YYYY-MM-DD'), venues.name), ${score(eventText)}
        from events left join venues on venues.id = events.venue_id
        where events.band_id = ${bandId} and events.archived_at is null and ${matches(eventText)}
      union all
      select 'venue', venues.id::text, venues.name, venues.address, ${score(venueText)}
        from venues
        where venues.band_id = ${bandId} and venues.archived_at is null and ${matches(venueText)}
      union all
      select 'contact', contacts.id::text, contacts.name, nullif(concat_ws(' · ', contacts.organisation, contacts.email), ''), ${score(contactText)}
        from contacts
        where contacts.band_id = ${bandId} and contacts.archived_at is null and ${matches(contactText)}
      order by score desc, label
      limit 40
    `)) as unknown as { rows: (SearchResult & { score: number })[] }
    return rows.map(({ score: _, ...r }) => r)
  }),
}

// History --------------------------------------------------------------------

type Change = typeof changes.$inferSelect
type Row = Record<string, unknown>

const entities: Record<string, string> = {
  songs: 'song', venues: 'venue', contacts: 'contact', events: 'event', blocks: 'block', setlists: 'setlist',
}
const human = (column: string) => column.replace(/_(id|sec)$/, '').replaceAll('_', ' ')

/** Event title per availability request, for history lines. */
async function requestEvents(tx: Tx, rows: Change[]) {
  const ids = new Set<string>()
  for (const c of rows) {
    const r = (c.after ?? c.before) as Row
    if (c.tableName === 'availability_requests') ids.add(r.id as string)
    else if (c.tableName === 'availability_responses') ids.add(r.request_id as string)
  }
  const found = ids.size
    ? await tx
        .select({ id: availabilityRequests.id, title: events.title })
        .from(availabilityRequests)
        .innerJoin(events, eq(events.id, availabilityRequests.eventId))
        .where(inArray(availabilityRequests.id, [...ids]))
    : []
  return (id: unknown) => found.find((f) => f.id === id)?.title ?? 'deleted'
}

/** Plain-language lines for one transaction's changes. Child rows are summed up by their parent. */
async function describe(tx: Tx, rows: Change[]) {
  const lines: string[] = []
  const setlistIds = new Set<string>()
  const blockIds = new Set<string>()
  const eventIds = new Set<string>()
  const people: { userId: string; before: Row | null; after: Row | null }[] = []
  const requestEvent = await requestEvents(tx, rows)
  const answerers: Row[] = [] // response rows that got an answer, named below with the members
  for (const c of rows) {
    const before = c.before as Row | null
    const after = c.after as Row | null
    const r = (after ?? before)!
    const entity = entities[c.tableName]
    if (c.tableName === 'memberships') people.push({ userId: r.user_id as string, before, after })
    else if (c.tableName === 'availability_requests') {
      const event = `event “${requestEvent(r.id)}”`
      if (c.action === 'insert') lines.push(`Asked availability for ${event}`)
      else if (after?.closed_at && !before?.closed_at) lines.push(`Closed the availability request for ${event}`)
    } else if (c.tableName === 'availability_responses') {
      if (after?.answer && (before?.answer !== after.answer || before?.note !== after.note)) answerers.push(after)
    } else if (entity) {
      const name = `${entity} “${r.title ?? r.name}”`
      if (c.action === 'insert') lines.push(`Added ${name}`)
      else if (c.action === 'delete') lines.push(`Removed ${name}`)
      else {
        const changed = Object.keys(after!).filter((k) => JSON.stringify(after![k]) !== JSON.stringify(before![k]))
        if (changed.length === 1 && changed[0] === 'archived_at') lines.push(`${after!.archived_at ? 'Archived' : 'Restored'} ${name}`)
        else if (changed.length) lines.push(`Changed ${name}: ${changed.filter((k) => k !== 'slug').map(human).join(', ')}`)
      }
    } else if (c.tableName === 'sets') setlistIds.add(r.setlist_id as string)
    else if (c.tableName === 'block_songs') blockIds.add(r.block_id as string)
    else if (c.tableName === 'event_contacts') eventIds.add(r.event_id as string)
  }
  if (people.length || answerers.length) {
    const wanted = [...people.map((p) => p.userId), ...answerers.map((a) => a.user_id as string)]
    const found = await tx.select({ id: users.id, email: users.email, name: users.name }).from(users).where(inArray(users.id, wanted))
    const email = (id: string) => found.find((u) => u.id === id)?.name || found.find((u) => u.id === id)?.email || 'someone'
    for (const { userId, before, after } of people) {
      const who = `“${email(userId)}”`
      if (!after) lines.push(`Removed member ${who}`)
      else if (!before || (before.archived_at && !after.archived_at)) lines.push(`Added ${after.role} ${who}`)
      else if (after.archived_at && !before.archived_at) lines.push(`Removed member ${who}`)
      else if (before.role !== after.role) lines.push(`Changed ${who} from ${before.role} to ${after.role}`)
    }
    for (const a of answerers) lines.push(`“${email(a.user_id as string)}” answered ${a.answer} for event “${requestEvent(a.request_id)}”`)
  }
  const names = async (table: typeof setlists | typeof blocks, ids: Set<string>) =>
    ids.size ? (await tx.select({ name: table.name }).from(table).where(inArray(table.id, [...ids]))).map((x) => x.name) : []
  for (const n of await names(setlists, setlistIds)) lines.push(`Changed setlist “${n}”`)
  for (const n of await names(blocks, blockIds)) lines.push(`Changed songs of block “${n}”`)
  if (eventIds.size)
    for (const e of await tx.select({ title: events.title }).from(events).where(inArray(events.id, [...eventIds])))
      lines.push(`Changed contacts of event “${e.title}”`)
  return [...new Set(lines)]
}

export type Diff = { what: string; field: string; from: string; to: string }

/** Columns that are bookkeeping, not something a person changed. */
const hidden = new Set(['id', 'band_id', 'slug', 'created_at', 'position'])
const refs = ['song_id', 'venue_id', 'contact_id', 'event_id', 'setlist_id', 'block_id', 'user_id']

/**
 * Field-by-field before → after for one transaction. Ids are shown as names; set and block songs
 * as the whole list (their saves rewrite every row, so before/after hold the full list).
 */
async function diff(tx: Tx, rows: Change[]): Promise<Diff[]> {
  // Names for every id these rows mention: current rows first, then names from the rows themselves (deleted since).
  const ids = new Set<string>()
  for (const c of rows)
    for (const r of [c.before, c.after] as (Row | null)[])
      for (const k of refs) if (typeof r?.[k] === 'string') ids.add(r[k] as string)
  const names = new Map<string, string>()
  for (const c of rows) for (const r of [c.before, c.after] as (Row | null)[]) if (r?.id) names.set(r.id as string, String(r.title ?? r.name))
  if (ids.size) {
    const list = sql.join([...ids].map((i) => sql`${i}::uuid`), sql`, `)
    const { rows: found } = (await tx.execute(sql`
      select id::text, title as name from songs where id in (${list})
      union all select id::text, name from venues where id in (${list})
      union all select id::text, name from contacts where id in (${list})
      union all select id::text, title from events where id in (${list})
      union all select id::text, name from setlists where id in (${list})
      union all select id::text, name from blocks where id in (${list})
      union all select id::text, coalesce(nullif(name, ''), email) from users where id in (${list})`)) as unknown as { rows: { id: string; name: string }[] }
    for (const f of found) names.set(f.id, f.name)
  }
  const name = (id: unknown) => (typeof id === 'string' ? (names.get(id) ?? 'deleted') : '–')
  const requestEvent = await requestEvents(tx, rows)
  const show = (k: string, v: unknown) => {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '–'
    if (refs.includes(k)) return name(v)
    if (k === 'archived_at') return 'yes'
    if (k === 'duration_sec') return formatDuration(v as number)
    return Array.isArray(v) ? v.join(', ') : String(v)
  }

  const out: Diff[] = []
  const lists = new Map<string, { what: string; field: string; before: Row[]; after: Row[] }>()
  const list = (key: string, what: string, field: string) =>
    lists.get(key) ?? lists.set(key, { what, field, before: [], after: [] }).get(key)!
  const setRows = rows.filter((c) => c.tableName === 'sets')
  const setOf = (id: unknown) => {
    const s = setRows.map((c) => (c.before ?? c.after) as Row).find((r) => r.id === id)
    return s && { setlist: s.setlist_id as string, name: s.name as string, position: s.position as number }
  }

  for (const c of rows) {
    const before = c.before as Row | null
    const after = c.after as Row | null
    const r = (after ?? before)!
    const entity = entities[c.tableName]
    if (entity) {
      const what = `${entity[0].toUpperCase()}${entity.slice(1)} “${r.title ?? r.name}”`
      for (const k of Object.keys(r)) {
        if (hidden.has(k)) continue
        const from = show(k, before?.[k])
        const to = show(k, after?.[k])
        if (from !== to) out.push({ what, field: human(k), from, to })
      }
    } else if (c.tableName === 'memberships') {
      const what = `Member “${name(r.user_id)}”`
      for (const k of ['role', 'archived_at']) {
        const from = show(k, before?.[k])
        const to = show(k, after?.[k])
        if (from !== to) out.push({ what, field: human(k), from, to })
      }
    } else if (c.tableName === 'availability_responses' && after) {
      const what = `Availability of “${name(r.user_id)}” for event “${requestEvent(r.request_id)}”`
      for (const k of ['answer', 'note']) {
        const from = show(k, before?.[k])
        const to = show(k, after[k])
        if (from !== to) out.push({ what, field: k, from, to })
      }
    } else if (c.tableName === 'event_contacts') {
      // Links are written per contact (only what changed), so show each one added or removed.
      out.push({ what: `Event “${name(r.event_id)}”`, field: 'contact', from: before ? name(before.contact_id) : '–', to: after ? name(after.contact_id) : '–' })
    } else if (c.tableName === 'block_songs') {
      const l = list(`bs:${r.block_id}`, `Block “${name(r.block_id)}”`, 'songs')
      if (before) l.before.push(before)
      if (after) l.after.push(after)
    } else if (c.tableName === 'sets' || c.tableName === 'set_items') {
      const setlist = c.tableName === 'sets' ? (r.setlist_id as string) : setOf(r.set_id)?.setlist
      if (!setlist) continue
      const l = list(`sl:${setlist}`, `Setlist “${name(setlist)}”`, 'sets')
      if (before) l.before.push({ ...before, table: c.tableName })
      if (after) l.after.push({ ...after, table: c.tableName })
    }
  }

  const songsOf = (rs: Row[]) =>
    rs
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map((x) => name(x.song_id))
      .join(', ') || '–'
  const setsOf = (rs: Row[]) =>
    rs
      .filter((x) => x.table === 'sets')
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map((s) => `${s.name}: ${songsOf(rs.filter((x) => x.table === 'set_items' && x.set_id === s.id))}`)
      .join('\n') || '–'
  for (const [key, l] of lists) {
    const render = key.startsWith('bs:') ? songsOf : setsOf
    const from = render(l.before)
    const to = render(l.after)
    if (from !== to) out.push({ what: l.what, field: l.field, from, to })
  }
  return out
}

const historyOps = {
  /**
   * The band's latest saves (one per transaction), newest first, in plain language.
   * With `item`: only saves that touched that row or its children (an event's contacts and
   * setlist, a setlist's sets and their songs, a block's songs).
   */
  listChanges: bandOp('reader', z.object({ item: z.string().uuid().optional() }), async ({ tx, bandId }, { item }) => {
    const parent = sql`coalesce(c.after, c.before)`
    const touchesItem = sql`${changes.txId} in (
      with recursive related(id) as (
        select ${item}::text
        union
        select c.row_id from changes c, related r
        where c.band_id = ${bandId}
          and ${parent} ->> (case c.table_name when 'setlists' then 'event_id' when 'sets' then 'setlist_id' end) = r.id
      )
      select c.tx_id from changes c
      where c.band_id = ${bandId} and (
        c.row_id in (select id from related)
        or ${parent} ->> 'event_id' in (select id from related)
        or ${parent} ->> 'setlist_id' in (select id from related)
        or ${parent} ->> 'set_id' in (select id from related)
        or ${parent} ->> 'block_id' in (select id from related)
      ))`
    const recent = await tx
      .select({ txId: changes.txId, at: sql<Date>`max(${changes.createdAt})`.mapWith(changes.createdAt) })
      .from(changes)
      .where(and(eq(changes.bandId, bandId), item ? touchesItem : undefined))
      .groupBy(changes.txId)
      .orderBy(desc(sql`max(${changes.id})`))
      .limit(50) // ponytail: no paging yet; add "older" when bands want to dig further back.
    if (!recent.length) return []
    const rows = await tx
      .select({ change: changes, name: users.name, email: users.email })
      .from(changes)
      .leftJoin(users, eq(users.id, changes.userId))
      .where(and(eq(changes.bandId, bandId), inArray(changes.txId, recent.map((r) => r.txId))))
      .orderBy(asc(changes.id))
    const result = []
    for (const { txId, at } of recent) {
      const mine = rows.filter((r) => r.change.txId === txId)
      const lines = await describe(tx, mine.map((r) => r.change))
      if (!lines.length) continue
      result.push({
        txId,
        at,
        who: mine[0].name || mine[0].email || 'System',
        lines,
        diffs: await diff(tx, mine.map((r) => r.change)),
      })
    }
    return result
  }),
}

// Availability -------------------------------------------------------------

const answerInput = z.object({ answer: z.enum(availabilityAnswer.enumValues), note: optText(500) })
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

async function availabilityEvent(tx: Tx, bandId: string, slug: string) {
  const [event] = await tx
    .select({ id: events.id, title: events.title, slug: events.slug, date: events.date, venue: venues.name })
    .from(events)
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(eq(events.bandId, bandId), eq(events.slug, slug)))
  if (!event) throw new NotFound()
  return event
}

// Notes only explain a maybe.
const answered = (answer: 'yes' | 'no' | 'maybe', note: string | null) => ({ answer, note: answer === 'maybe' ? note : null, answeredAt: new Date() })

/** Record an answer; the request closes itself once everyone asked has answered. */
async function saveAnswer(tx: Tx, responseId: string, requestId: string, answer: 'yes' | 'no' | 'maybe', note: string | null) {
  await tx.update(availabilityResponses).set(answered(answer, note)).where(eq(availabilityResponses.id, responseId))
  const [waiting] = await tx
    .select({ id: availabilityResponses.id })
    .from(availabilityResponses)
    .where(and(eq(availabilityResponses.requestId, requestId), isNull(availabilityResponses.answer)))
    .limit(1)
  if (!waiting) await tx.update(availabilityRequests).set({ closedAt: new Date() }).where(eq(availabilityRequests.id, requestId))
}

const availabilityOps = {
  /** The event's latest request (open, or the last closed one) with everyone's answer; null if never asked. */
  getAvailability: bandOp('reader', z.object({ event: z.string() }), async ({ tx, bandId, userId }, { event: slug }) => {
    const event = await availabilityEvent(tx, bandId, slug)
    const [request] = await tx
      .select()
      .from(availabilityRequests)
      .where(eq(availabilityRequests.eventId, event.id))
      .orderBy(desc(availabilityRequests.createdAt))
      .limit(1)
    if (!request) return null
    const responses = await tx
      .select({
        userId: availabilityResponses.userId,
        name: users.name,
        email: users.email,
        answer: availabilityResponses.answer,
        note: availabilityResponses.note,
      })
      .from(availabilityResponses)
      .innerJoin(users, eq(users.id, availabilityResponses.userId))
      .where(eq(availabilityResponses.requestId, request.id))
      .orderBy(asc(users.name), asc(users.email))
    return {
      open: !request.closedAt,
      date: request.date,
      stale: request.date !== event.date, // the event moved after people were asked
      responses: responses.map(({ userId: id, ...r }) => ({ ...r, mine: id === userId })),
    }
  }),

  /**
   * Ask these members/readers (by email) whether they can make the event. Returns what the caller
   * needs to mail each person their personal link; the tokens exist nowhere else (only hashes are stored).
   */
  askAvailability: bandOp(
    'member',
    z.object({ event: z.string(), emails: z.array(z.string().trim().toLowerCase()).min(1).max(100) }),
    async ({ tx, bandId, userId }, { event: slug, emails }) => {
      const event = await availabilityEvent(tx, bandId, slug)
      const people = await tx
        .select({ id: users.id, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.bandId, bandId), isNull(memberships.archivedAt), inArray(users.email, emails)))
      if (people.length !== new Set(emails).size) throw new NotFound()
      const [open] = await tx
        .select({ id: availabilityRequests.id })
        .from(availabilityRequests)
        .where(and(eq(availabilityRequests.eventId, event.id), isNull(availabilityRequests.closedAt)))
      if (open) throw new Error('This event is already being asked. Close that request first.')
      const [request] = await tx
        .insert(availabilityRequests)
        .values({ bandId, eventId: event.id, date: event.date, askedBy: userId })
        .returning({ id: availabilityRequests.id })
      const recipients = people.map((p) => ({ ...p, token: randomBytes(32).toString('base64url') }))
      await tx
        .insert(availabilityResponses)
        .values(recipients.map((r) => ({ bandId, requestId: request.id, userId: r.id, tokenHash: sha256(r.token) })))
      const [band] = await tx.select({ name: bands.name, slug: bands.slug }).from(bands).where(eq(bands.id, bandId))
      return { band, event, recipients }
    },
  ),

  /** Stop asking. The answers stay visible. */
  closeAvailability: bandOp('member', z.object({ event: z.string() }), async ({ tx, bandId }, { event: slug }) => {
    const event = await availabilityEvent(tx, bandId, slug)
    const [closed] = await tx
      .update(availabilityRequests)
      .set({ closedAt: new Date() })
      .where(and(eq(availabilityRequests.eventId, event.id), isNull(availabilityRequests.closedAt)))
      .returning({ id: availabilityRequests.id })
    if (!closed) throw new NotFound()
  }),

  /** Answer (or change your answer to) the open request, from inside the app. */
  answerAvailability: bandOp('reader', answerInput.extend({ event: z.string() }), async ({ tx, bandId, userId }, { event: slug, answer, note }) => {
    const event = await availabilityEvent(tx, bandId, slug)
    const [mine] = await tx
      .select({ id: availabilityResponses.id, requestId: availabilityResponses.requestId })
      .from(availabilityResponses)
      .innerJoin(availabilityRequests, eq(availabilityRequests.id, availabilityResponses.requestId))
      .where(and(eq(availabilityRequests.eventId, event.id), isNull(availabilityRequests.closedAt), eq(availabilityResponses.userId, userId)))
    if (!mine) throw new NotFound()
    await saveAnswer(tx, mine.id, mine.requestId, answer, note)
  }),
}

/** The response behind an emailed link, if the person is still in the band. */
async function responseByToken(tx: Tx, token: string) {
  const [row] = await tx
    .select({
      id: availabilityResponses.id,
      requestId: availabilityResponses.requestId,
      userId: availabilityResponses.userId,
      answer: availabilityResponses.answer,
      note: availabilityResponses.note,
      name: users.name,
      closed: availabilityRequests.closedAt,
      date: availabilityRequests.date,
      eventDate: events.date,
      eventTitle: events.title,
      venue: venues.name,
      bandName: bands.name,
    })
    .from(availabilityResponses)
    .innerJoin(availabilityRequests, eq(availabilityRequests.id, availabilityResponses.requestId))
    .innerJoin(events, eq(events.id, availabilityRequests.eventId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(bands, eq(bands.id, availabilityRequests.bandId))
    .innerJoin(users, eq(users.id, availabilityResponses.userId))
    .innerJoin(
      memberships,
      and(eq(memberships.bandId, availabilityRequests.bandId), eq(memberships.userId, availabilityResponses.userId), isNull(memberships.archivedAt)),
    )
    .where(and(eq(availabilityResponses.tokenHash, sha256(token)), isNull(bands.archivedAt)))
  if (!row) throw new NotFound()
  return row
}

/**
 * Link-based answering: no login, the token is the credential. It reaches exactly one answer.
 * Reading never changes anything (mail scanners prefetch links); only answerByToken writes.
 */
export function availabilityByToken(db: Db, token: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction read only`)
    const r = await responseByToken(tx, token)
    return {
      band: r.bandName,
      name: r.name,
      event: r.eventTitle,
      venue: r.venue,
      date: r.date,
      stale: r.date !== r.eventDate,
      closed: !!r.closed,
      answer: r.answer,
      note: r.note,
    }
  })
}

export async function answerByToken(db: Db, token: string, rawInput: unknown) {
  const input = answerInput.parse(rawInput)
  return db.transaction(async (tx) => {
    const r = await responseByToken(tx, token)
    if (r.closed) throw new Error('This request is closed')
    await tx.execute(sql`select set_config('app.user_id', ${r.userId}, true)`) // the audit trail shows who answered
    await saveAnswer(tx, r.id, r.requestId, input.answer, input.note)
  })
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
  ...fileOps,
  ...feedbackOps,
  ...memberOps,
  ...eventOps,
  ...venueContactOps,
  ...setlistOps,
  ...searchOps,
  ...historyOps,
  ...availabilityOps,
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

// Instance admin -----------------------------------------------------------
// Not band-scoped: fns.ts checks ADMIN_EMAILS before calling these.

/** Band slugs live at the top level, next to these routes. */
const reservedBandSlugs = ['admin', 'api', 'login', 'me', 'new']

export function listAllBands(db: Db) {
  return db
    .select({
      slug: bands.slug,
      name: bands.name,
      archivedAt: bands.archivedAt,
      members: sql<string[]>`coalesce(array_agg(${users.email} order by ${users.email}) filter (where ${users.email} is not null), '{}')`,
      // Archived files still occupy storage, so they count.
      fileBytes: sql<number>`coalesce((select sum(${files.sizeBytes}) from ${files} where ${files.bandId} = ${bands.id}), 0)::float8`,
    })
    .from(bands)
    .leftJoin(memberships, and(eq(memberships.bandId, bands.id), isNull(memberships.archivedAt)))
    .leftJoin(users, eq(users.id, memberships.userId))
    .groupBy(bands.id)
    .orderBy(sql`${bands.archivedAt} is not null`, asc(bands.name))
}

export function listFeedback(db: Db) {
  return db
    .select({ id: feedback.id, body: feedback.body, createdAt: feedback.createdAt, email: users.email, name: users.name, band: bands.name })
    .from(feedback)
    .innerJoin(users, eq(users.id, feedback.userId))
    .leftJoin(bands, eq(bands.id, feedback.bandId))
    .orderBy(desc(feedback.createdAt))
}

const newBand = z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().toLowerCase().email().max(200) })

/** A band always starts with a first member, so there are no bands nobody can reach. */
export async function createBand(db: Db, rawInput: z.input<typeof newBand>) {
  const { name, email } = newBand.parse(rawInput)
  return db.transaction(async (tx) => {
    let slug = ''
    for (const s of numbered(slugify(name))) {
      if (reservedBandSlugs.includes(s)) continue
      const [taken] = await tx.select({ id: bands.id }).from(bands).where(eq(bands.slug, s)) // archived bands keep theirs
      if (!taken) {
        slug = s
        break
      }
    }
    const [band] = await tx.insert(bands).values({ slug, name }).returning()
    // Invitation only: having a users row is what lets them sign in (auth.ts).
    await tx.insert(users).values({ name: '', email }).onConflictDoNothing()
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
    await tx.insert(memberships).values({ bandId: band.id, userId: user.id, role: 'member' })
    return { slug: band.slug, name: band.name }
  })
}

/** Soft delete: the band disappears for everyone; its data stays in the DB. */
export async function archiveBand(db: Db, slug: string) {
  const [band] = await db
    .update(bands)
    .set({ archivedAt: new Date() })
    .where(and(eq(bands.slug, slug), isNull(bands.archivedAt)))
    .returning({ id: bands.id })
  if (!band) throw new NotFound()
}

/**
 * Hard delete, only after archiveBand: every row of the band, including its history.
 * Users stay (they may be in other bands).
 */
export async function deleteBandForever(db: Db, slug: string) {
  await db.transaction(async (tx) => {
    const [band] = await tx
      .select({ id: bands.id })
      .from(bands)
      .where(and(eq(bands.slug, slug), isNotNull(bands.archivedAt)))
    if (!band) throw new NotFound()
    // Children before parents (foreign keys).
    for (const table of [availabilityResponses, availabilityRequests, files, feedback, setItems, sets, setlists, blockSongs, blocks, eventContacts, events, contacts, venues, songs, slugRedirects, memberships])
      await tx.delete(table).where(eq(table.bandId, band.id))
    await tx.delete(slugRedirects).where(and(eq(slugRedirects.type, 'band'), eq(slugRedirects.entityId, band.id)))
    await tx.delete(bands).where(eq(bands.id, band.id))
    await tx.delete(changes).where(eq(changes.bandId, band.id)) // last: the deletes above were logged too
  })
}
