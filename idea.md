# Gigg

An open source tool that helps bands plan events, setlists and technical riders.

Installable PWA. Everything must be readable on a mobile phone, also offline.

## Principles

- **Simple authorisation.** Two roles, no band admin.
- **Archive, never delete.** Every record has `archived_at`; every change is logged (audit trail), so it's always visible who changed what and what it was before.
- **No band specifics in code.** gigg.band is just one instance.
- **Easy to self-host on Vercel.** Clear guide; free tiers should be enough for a single band.
- **No external services where avoidable** (feedback, search, etc. live in the app).

## Hosting

- gigg.band is **invitation only** at the start, to keep costs down.
- Anyone can self-host: deploy to Vercel, link a database, set env vars, done.

## Languages

English and Dutch (informal *je*). Each user has a language, changeable in Settings; someone invited gets the inviter's. Signed out, the browser's language decides. Emails, the emailed availability page and the calendar feed use the recipient's language; history is written in the viewer's. URLs, user content and stored values stay as they are. A third language is one more dictionary file.

## Auth & access

- Login: **passkeys + email magic link**. No passwords.
- Roles per band:
  - `reader`: read only
  - `member`: everything, including inviting members/readers
- Instance admin: env var with admin emails (no role in DB). Self-hosters set their own.
- **Creating a band is admin only.** The admin creates the band and adds its first member(s). Band invites by members: later.
- A logged-in user still sees the public site; the user menu leads to `/<band>`. After login → straight to `/<band>`.
- No public band page. Only explicitly shared links are public.

URLs:

```
gigg.band/one-after-909/events/agnietenhof
gigg.band/one-after-909/songs/a-day-in-a-life
```

Old slugs redirect after a rename.

## Events

The term is **events** (URL `/<band>/events/<slug>`), not events.

- Title, date, optional start and end time (an end before the start is the next day), files. Other times (load-in, soundcheck) go in the free-form notes.
- Slug: slugified title; if taken, the date in front (`2026-12-05-agnietenhof`), only then `-2`.
- Linked **venue** (own record, reusable)
- Linked **contact(s)** (own record, reusable)
- Venue and contacts are **search boxes** in the event form. A new name creates the venue/contact right there, without leaving the form. Picking a venue suggests the contacts used last time at that venue.
- Band start page = upcoming events. Past events are behind a button.
- Two independent statuses:

| Field   | Values                                                 |
|---------|--------------------------------------------------------|
| Booking | `lead → option → confirmed` (+ `cancelled`)            |
| Payment | `open → invoiced → paid`                               |

  Paid upfront = `confirmed` + `paid`. Paid afterwards = past `confirmed` + `invoiced`. Played is implicit: a confirmed event in the past.
- Free tags for anything else.
- Calendar feed: Settings → Calendar gives each person a private link per band to subscribe to in Google or Apple Calendar. It has options (tentative, “(option)” in front), and confirmed events from the past year on; the description has the notes and a link to the event.

## Songs (repertoire)

Fixed fields: title, duration, key, BPM, tuning/instrument changes, notes, tags. Files attached (lyrics, recordings, sheets).

## Setlists

```
Setlist
└── Set (Set 1, Set 2 after break, …)
    ├── Song
    ├── Block (Acoustic bit, Encore, …)
    │   └── Song, Song, …
    └── Song
```

- **Blocks are reusable templates**: define "Acoustic bit" or "Encore" once. Adding a block to a set *copies* its songs into the setlist, with no live reference, so later edits to the block never change existing setlists (including played events).

- Linked to an event (one setlist per event), at `/<band>/events/<event>/setlist`
- **Standalone setlists** (no event: "Standard 2 sets", "Short club set") at `/<band>/setlists`. A new event can start from a copy of one (picked in the event form); copies, never live links, like blocks.
- Builder: every change saves immediately; songs move by drag and drop, within a set or between sets (long-press on touch with a small haptic tick, a grip handle with a mouse; a yellow line shows where it lands); dragged out of the setlist (above/below the sets, or to the screen's side edge) removes it. Blocks reorder the same way. ↑ ↓ stay for the keyboard, visible on focus; new setlist starts empty or as a copy of another setlist (standalone or an event's)
- Blocks are managed at `/<band>/blocks` (linked from Songs and the builder)
- Clonable
- Total duration per set / setlist
- **Show mode** (single person): one whole set per screen in big type, swipe to the next set, screen stays on, per-song notes visible, works offline.
- **Stage-floor PDF export**: the key export. One page per set. Blocks are not shown as headings, only their songs.

## History

Each edit page links to that item's history (`/<band>/history?item=<id>`): every save that touched it, in plain language ("Archived song “Closer”", "Changed setlist “Wedding”"), who and when, newest first. A save folds open to show each field before → after (setlists and blocks as their song lists). No undo.

## Files

Common PDFs, recordings, lyrics, song notes, riders. Attachable to songs and events (several each; listed on their pages, members upload and remove). Bytes live in Vercel Blob (private; a local folder in dev), served through `/api/files/<id>` to band members only. Up to 100 MB each: in production the browser uploads straight to Blob (token from `/api/files/upload`, multipart above 8 MB) and downloads via a 5-minute signed URL, so big files never pass through a function. Band-level files not yet.
**Public share links** per file: token-based, revocable.

## Search

`/<band>/search`, linked from the band navigation. Results update as you type.

- Songs (title), events (title and venue name), venues (name, address), contacts (name, organisation, email)
- Substring matches plus typo tolerance (Postgres `pg_trgm` `word_similarity`), best first; no separate search service
- Venue/contact results open their row on the settings page
- Archived items are left out. Files come with the files feature.

## Offline

**Read-only.** A small service worker (`public/sw.js`) caches every GET network-first: pages, the single client bundle, and read operations (`get*`/`list*`/`search` go over GET, in a read-only transaction). Offline, the last cached copy is served; writes fail. The events list preloads the next three gigs and their setlists. Logging out clears the cache. No sync engine, no conflict handling.

## Feedback

Anyone in a band sends feedback from the account menu (`/<band>/feedback`); the admin page lists it. Later: optional push to GitHub Issues via backend API (users don't need a GitHub account).

## Admin

Create bands. Stats: bands, users, DB size. Feedback overview.

## Settings

One page per band: `/<band>/settings`, reached from the user menu (avatar with the first letter of the email: email, bands, settings, log out).

- **You:** email, add a passkey, theme (System / Light / Dark; per device, in a cookie)
- **The band** (members): venues and contacts. Rarely change, so they're edited here, not in the main navigation. Archived ones leave the event form's search boxes but stay on old events.
- **Members** (members only): list, invite by email as member or reader (existing people get their role changed), remove. Removing archives the membership; you can't remove yourself.

## Stack

| Layer | Choice |
|---|---|
| Framework | **TanStack Start** (Vite, TanStack Router + Query, server functions), deployed on Vercel |
| Database | Postgres on **Neon** (Vercel marketplace); every table has `band_id` |
| Local dev / test DB | **PGlite** (Postgres in WASM, supports triggers + `pg_trgm`) |
| DB toolkit | **Drizzle** (custom SQL migrations for the audit trigger) |
| Auth | **Better Auth** (passkey + magic-link plugins) |
| Email | **SMTP** (one env var; any provider, e.g. Resend) |
| Files | **Vercel Blob** |
| PWA / offline | Hand-written service worker, network-first cache of GETs |
| Search | Postgres `pg_trgm` |
| Stage-floor PDF | Print stylesheet first; PDF library only if phone download is clumsy |

Pin exact versions (TanStack Start 1.0 is new). Keep the TanStack Start docs at hand for AI agents.

Data model: see [data-model.md](data-model.md).

## Testing

TDD not required, but code must be easily testable: logic in plain functions / server functions, no hidden globals.

**Vitest against PGlite (bulk of the tests).** Server functions run against a fresh in-memory Postgres (migrated once, cloned per test). Covers:
- Authorisation: reader can't write; **a generic test runs every server function as an outsider of the band** (no cross-band leaks)
- Audit trail: every write logged with the right user
- Archive / restore, slug redirects
- Setlists: block is copied (unaffected by later block edits), durations, clone
- Fuzzy search

**Playwright end-to-end (critical user journeys only)**, against a production build with PGlite + seed:
- Passkey login (virtual authenticator), email-link login (test-mode outbox)
- Song → setlist with block → event
- Show mode offline (`context.setOffline`)
- Stage-floor PDF: page count = number of sets
- Public file link works, then is revoked
- Reader sees no edit buttons
- Mobile profiles (iPhone/WebKit, Pixel/Chromium)
- `@axe-core/playwright` accessibility check per page

**Left out for now:** component tests, screenshot comparisons, coverage thresholds.

**CI (GitHub Actions)** on every PR *and* every push to `main` (early on, merges to `main` are frequent): type check → Vitest → build → Playwright. No database service needed. PRs are a hard boundary: all green before merge. Later: smoke test against the Vercel preview deploy.

## Dev

- Easy dev mode: `pnpm dev` runs on PGlite with seed data, no cloud accounts needed.
- Production DB easy to back up (`pg_dump` / Neon branching).
- Skills not in repo.
- GitHub Issues should not show factory-related labels.
- Privacy: audit log references user IDs; a user record can be anonymised when someone leaves.

### Dev manual

How to self-host on Vercel, step by step.

## MVP

1. Auth (passkey + email link), admin creates bands and adds members/readers
2. Songs with fixed fields + files
3. Events with venues, contacts, booking + payment status
4. Setlists (sets, blocks, songs), clone, show mode
5. Stage-floor PDF export (one page per set)
6. Search
7. Offline read-only
8. Archive + audit trail (from day one: every write goes through one place)

## Backlog

- **Excel export (first up after MVP)**, then Numbers / CSV (setlist, repertoire, event overview)
- **Download everything upcoming**: one tap to save all upcoming events, setlists and their songs (and later files) to the device, for offline use without visiting each page
- Member availability per event
- Other PDFs (band/sound engineer setlist with key/BPM, event sheet)
- Custom song fields per band
- Lead singer per song
- Per-song notes in a setlist ("longer intro tonight")
- Account linking
- Generated tech rider / stage plot / input list
- Notifications (push / email)
- Keep the in-app manual (`/manual`, a short static page) up to date automatically using skills

### From feedback (2026-11-12)

Each of these needs a **grill-me session** before building: the open questions below get settled first.

- **C. Availability vs. assignment (decide first, A and B depend on it).** Find the balance between asking everyone whether they can make it and just assigning the people who are relevant to an event. Also: log your non-availability ahead of time (holidays, blocked dates), maybe pre-filling answers to availability checks. Open: does an event get a list of assigned people, and how does that relate to availability answers?
- **A. Event filtering and default view.** Filter the events list; by default show only confirmed gigs you're part of. Remember the chosen view per user or device. The same filter for the iCal feed ("only my events/gigs"). Open: what "part of" means (see C).
- **B. Event types and money.** Event types such as *repetitie* (rehearsal) besides gigs. A fee field (*vergoeding*) per event, with free events as an empty or zero fee; later, totals per year. Open: which fields (booking/payment status, fee) apply to which type.
- **D. Setlists and songs.** ~~Drag and drop~~ (done). Personal notes per song, visible only to you (different from per-song notes in a setlist). A setting for which song fields a setlist shows (key, BPM, duration…), tied in with the other PDFs.
- **Styled invite emails.** HTML emails with branding instead of plain text.

### From feedback (2026-11-12, second batch)

Already covered above: C (availability vs. assignment, non-availability), A (iCal "only my events"), B (event types, fee, free events), D (drag and drop, personal song notes, setlist fields), styled invite emails.

- **Mobile date/time layout.** In the past events list on mobile, show date and time side by side. On the event view, when date and time don't fit on one line, break between date and time.
- **Theme and language controls.** Theme as a three-way toggle (light/dark/system); language as a dropdown with flags.
- **Setlist header buttons.** The buttons above a setlist don't feel right yet; rethink their layout.
- **Offline = reader.** When offline, behave as a reader: hide all edit buttons. Also fix the events filter, which fails in offline mode.
