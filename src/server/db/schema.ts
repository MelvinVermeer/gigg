// App schema. See data-model.md. Auth tables live in auth-schema.ts.
import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth-schema'

export * from './auth-schema'

const id = () => uuid('id').defaultRandom().primaryKey()
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const archivedAt = () => timestamp('archived_at', { withTimezone: true })
const bandId = () => uuid('band_id').notNull().references(() => bands.id)
const trgm = (name: string, col: any) => index(name).using('gin', col.op('gin_trgm_ops'))

// People & bands ----------------------------------------------------------

export const bands = pgTable('bands', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull().default('Europe/Amsterdam'), // hidden setting, see data-model.md
  createdAt: createdAt(),
  archivedAt: archivedAt(),
})

export const role = pgEnum('role', ['reader', 'member'])

export const memberships = pgTable(
  'memberships',
  {
    bandId: bandId(),
    userId: uuid('user_id').notNull().references(() => users.id),
    role: role('role').notNull(),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [primaryKey({ columns: [t.bandId, t.userId] })],
)

// Old slugs → current entity, for redirects after a rename.
export const slugRedirects = pgTable(
  'slug_redirects',
  {
    id: id(),
    bandId: uuid('band_id').references(() => bands.id), // null for band slugs
    type: text('type').notNull(), // 'band' | 'song' | 'event' | ...
    oldSlug: text('old_slug').notNull(),
    entityId: uuid('entity_id').notNull(),
  },
  (t) => [unique().on(t.bandId, t.type, t.oldSlug).nullsNotDistinct()],
)

// Repertoire --------------------------------------------------------------

export const songs = pgTable(
  'songs',
  {
    id: id(),
    bandId: bandId(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    durationSec: integer('duration_sec'),
    key: text('key'),
    bpm: integer('bpm'),
    tuning: text('tuning'),
    notes: text('notes'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    // Values of the band's custom song fields, by song_fields.id. Only filled ones are stored.
    custom: jsonb('custom').$type<Record<string, string>>().notNull().default({}),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [unique().on(t.bandId, t.slug), trgm('songs_title_trgm', t.title)],
)

// Custom song fields: single-line text the band adds to every song ("Lead vocal"). Shown in
// creation order, after the fixed fields. Archiving hides it but keeps the values in songs.custom.
// Names are unique per band ignoring case, archived ones included (restoring never collides).
export const songFields = pgTable(
  'song_fields',
  {
    id: id(),
    bandId: bandId(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [uniqueIndex('song_fields_name').on(t.bandId, sql`lower(${t.name})`)],
)

// Which song fields each person shows per setlist output (page, show, print, excel). No row = the
// defaults (see lib/song-fields.ts). Not audited: a personal view setting, not band data.
export const shownFields = pgTable(
  'shown_fields',
  {
    bandId: bandId(),
    userId: uuid('user_id').notNull().references(() => users.id),
    fields: jsonb('fields').$type<Record<string, string[]>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.bandId, t.userId] })],
)

// Venues & contacts -------------------------------------------------------

export const venues = pgTable(
  'venues',
  {
    id: id(),
    bandId: bandId(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    notes: text('notes'),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [unique().on(t.bandId, t.slug), trgm('venues_name_trgm', t.name)],
)

export const contacts = pgTable(
  'contacts',
  {
    id: id(),
    bandId: bandId(),
    name: text('name').notNull(),
    organisation: text('organisation'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [trgm('contacts_name_trgm', t.name)],
)

// Events ------------------------------------------------------------------

export const bookingStatus = pgEnum('booking_status', ['lead', 'option', 'confirmed', 'cancelled'])
export const paymentStatus = pgEnum('payment_status', ['open', 'invoiced', 'paid', 'free'])

export const events = pgTable(
  'events',
  {
    id: id(),
    bandId: bandId(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    date: date('date').notNull(),
    // Optional wall-clock times in the band's time zone. An end before the start is the next day.
    startTime: time('start_time'),
    endTime: time('end_time'),
    venueId: uuid('venue_id').references(() => venues.id),
    bookingStatus: bookingStatus('booking_status').notNull().default('lead'),
    paymentStatus: paymentStatus('payment_status').notNull().default('open'),
    fee: text('fee'), // free text: "€450 + drinks"
    tags: text('tags').array().notNull().default(sql`'{}'`),
    notes: text('notes'),
    // A standard (standalone) setlist used as is. Null: the event has its own (custom) setlist.
    setlistId: uuid('setlist_id').references((): AnyPgColumn => setlists.id),
    // Null for events created before this column existed and not traceable in `changes`.
    createdBy: uuid('created_by').references(() => users.id),
    // Set while the availability check is closed: nobody can answer. Asking or reopening clears it.
    availabilityClosedAt: timestamp('availability_closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [unique().on(t.bandId, t.slug), trgm('events_title_trgm', t.title)],
)

export const eventContacts = pgTable(
  'event_contacts',
  {
    bandId: bandId(),
    eventId: uuid('event_id').notNull().references(() => events.id),
    contactId: uuid('contact_id').notNull().references(() => contacts.id),
    role: text('role'), // 'promoter', 'sound', ...
  },
  (t) => [primaryKey({ columns: [t.eventId, t.contactId] })],
)

// Calendar feed: one secret link per person per band. Not audited: history would show the token.
export const calendarFeeds = pgTable(
  'calendar_feeds',
  {
    bandId: bandId(),
    userId: uuid('user_id').notNull().references(() => users.id),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.bandId, t.userId] })],
)

// Availability ------------------------------------------------------------

export const availabilityAnswer = pgEnum('availability_answer', ['yes', 'no', 'maybe'])

// Legacy: the old per-check model, replaced by `event_people` (migration 0010 copied it over).
// Kept read-only so old history lines still name their event.
export const availabilityRequests = pgTable(
  'availability_requests',
  {
    id: id(),
    bandId: bandId(),
    eventId: uuid('event_id').notNull().references(() => events.id),
    date: date('date').notNull(),
    askedBy: uuid('asked_by').notNull().references(() => users.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('availability_one_open').on(t.eventId).where(sql`${t.closedAt} is null`)],
)

// One row per person asked; answer is null while waiting. The emailed link carries a random token; only its hash is stored.
export const availabilityResponses = pgTable(
  'availability_responses',
  {
    id: id(),
    bandId: bandId(),
    requestId: uuid('request_id').notNull().references(() => availabilityRequests.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    answer: availabilityAnswer('answer'),
    note: text('note'),
    tokenHash: text('token_hash').notNull().unique(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.requestId, t.userId)],
)

// The people on an event, each with an availability state: not asked (asked_for null) → waiting (answer null)
// → yes / maybe / no. `asked_for` is the event date they were asked about; if the event moves, the answer is stale.
// Asking gives a new emailed link: a random token, only its hash is stored.
export const eventPeople = pgTable(
  'event_people',
  {
    id: id(),
    bandId: bandId(),
    eventId: uuid('event_id').notNull().references(() => events.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    answer: availabilityAnswer('answer'),
    note: text('note'),
    tokenHash: text('token_hash').unique(),
    askedFor: date('asked_for'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.eventId, t.userId)],
)

// Setlists ----------------------------------------------------------------

export const setlists = pgTable('setlists', {
  id: id(),
  bandId: bandId(),
  eventId: uuid('event_id').unique().references(() => events.id), // one setlist per event
  name: text('name').notNull(),
  createdAt: createdAt(),
  archivedAt: archivedAt(),
})

export const sets = pgTable('sets', {
  id: id(),
  bandId: bandId(),
  setlistId: uuid('setlist_id').notNull().references(() => setlists.id),
  position: integer('position').notNull(),
  name: text('name').notNull(), // 'Set 1', 'Set 2 (after break)'
})

export const setItems = pgTable(
  'set_items',
  {
    bandId: bandId(),
    setId: uuid('set_id').notNull().references(() => sets.id),
    position: integer('position').notNull(),
    songId: uuid('song_id').notNull().references(() => songs.id),
  },
  (t) => [primaryKey({ columns: [t.setId, t.position] })],
)

// Block = template. Adding it to a set copies its songs into set_items;
// the set keeps no reference to the block.
export const blocks = pgTable('blocks', {
  id: id(),
  bandId: bandId(),
  name: text('name').notNull(), // 'Acoustic bit', 'Encore'
  createdAt: createdAt(),
  archivedAt: archivedAt(),
})

export const blockSongs = pgTable(
  'block_songs',
  {
    bandId: bandId(),
    blockId: uuid('block_id').notNull().references(() => blocks.id),
    position: integer('position').notNull(),
    songId: uuid('song_id').notNull().references(() => songs.id),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.position] })],
)

// Files -------------------------------------------------------------------

export const files = pgTable(
  'files',
  {
    id: id(),
    bandId: bandId(),
    songId: uuid('song_id').references(() => songs.id), // both null = band-level file
    eventId: uuid('event_id').references(() => events.id),
    name: text('name').notNull(),
    blobPath: text('blob_path').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    shareToken: text('share_token').unique(), // non-null = public link; revoke = set null
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [
    check('files_one_owner', sql`${t.songId} is null or ${t.eventId} is null`),
    trgm('files_name_trgm', t.name),
  ],
)

// Feedback ----------------------------------------------------------------

export const feedback = pgTable('feedback', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bandId: uuid('band_id').references(() => bands.id),
  body: text('body').notNull(),
  githubIssueUrl: text('github_issue_url'),
  createdAt: createdAt(),
  /** Handled by the admin: hidden from the default list. */
  doneAt: timestamp('done_at', { withTimezone: true }),
})

// Audit trail: written only by the audit() trigger (see drizzle/*_audit.sql).

export const changes = pgTable(
  'changes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bandId: uuid('band_id'),
    userId: uuid('user_id'),
    tableName: text('table_name').notNull(),
    rowId: text('row_id'), // null for tables with a composite key; see before/after
    action: text('action').notNull(), // 'insert' | 'update' | 'delete'
    before: jsonb('before'),
    after: jsonb('after'),
    // Groups the rows one save wrote, so history shows and undoes them together.
    txId: bigint('tx_id', { mode: 'number' }).notNull().default(sql`txid_current()`),
    createdAt: createdAt(),
  },
  (t) => [index('changes_band_idx').on(t.bandId, t.createdAt), index('changes_tx_idx').on(t.txId)],
)
