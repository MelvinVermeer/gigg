// App schema. See data-model.md. Auth tables live in auth-schema.ts.
import { sql } from 'drizzle-orm'
import {
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
  timestamp,
  unique,
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
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => [unique().on(t.bandId, t.slug), trgm('songs_title_trgm', t.title)],
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

export const bookingStatus = pgEnum('booking_status', ['lead', 'option', 'confirmed', 'played', 'cancelled'])
export const paymentStatus = pgEnum('payment_status', ['open', 'invoiced', 'paid'])

export const events = pgTable(
  'events',
  {
    id: id(),
    bandId: bandId(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    date: date('date').notNull(),
    venueId: uuid('venue_id').references(() => venues.id),
    bookingStatus: bookingStatus('booking_status').notNull().default('lead'),
    paymentStatus: paymentStatus('payment_status').notNull().default('open'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    notes: text('notes'),
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
