# Gigg

An open source tool that helps bands plan gigs, setlists and technical riders.

Installable PWA. Everything must be readable on a mobile phone, also offline.

## Principles

- **Simple authorisation.** Two roles, no band admin.
- **Archive, never delete.** Every record has `archived_at`; every change is logged (audit trail). Mistakes can always be undone, which is what makes the simple authorisation safe.
- **No band specifics in code.** gigg.band is just one instance.
- **Easy to self-host on Vercel.** Clear guide; free tiers should be enough for a single band.
- **No external services where avoidable** (feedback, search, etc. live in the app).

## Hosting

- gigg.band is **invitation only** at the start, to keep costs down.
- Anyone can self-host: deploy to Vercel, link a database, set env vars, done.

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

## Gigs (events)

- Name, date (one date; times and other details go in the free-form notes), files
- Linked **venue** (own record, reusable)
- Linked **contact(s)** (own record, reusable)
- Two independent statuses:

| Field   | Values                                                 |
|---------|--------------------------------------------------------|
| Booking | `lead → option → confirmed → played` (+ `cancelled`)   |
| Payment | `open → invoiced → paid`                               |

  Paid upfront = `confirmed` + `paid`. Paid afterwards = `played` + `invoiced`. Filters like "played but not paid" just work.
- Free tags for anything else.
- Add to calendar / iCal feed with all gigs.

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

- **Blocks are reusable templates**: define "Acoustic bit" or "Encore" once. Adding a block to a set *copies* its songs into the setlist, with no live reference, so later edits to the block never change existing setlists (including played gigs).

- Linked to a gig (one setlist per gig)
- Clonable
- Total duration per set / setlist
- **Show mode** (single person): big type, swipe between songs, screen stays on, per-song notes visible, works offline.
- **Stage-floor PDF export**: the key export. One page per set. Blocks are not shown as headings, only their songs.

## Files

Common PDFs, recordings, lyrics, song notes, riders. Attachable to songs, gigs, band.
**Public share links** per file: token-based, revocable.

## Search

Fast, fuzzy, typed: songs / gigs / contacts / venues / files. Postgres `pg_trgm`, no separate search service.

## Offline

**Read-only.** Service worker + TanStack Query cache persisted to IndexedDB, refreshed when online. No sync engine, no conflict handling.

## Feedback

Stored in the app. Optional push to GitHub Issues via backend API (users don't need a GitHub account).

## Admin

Create bands. Stats: bands, users, DB size. Feedback overview.

## User settings

- Light / dark mode
- Add a band
- Band settings (members, invites)

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
| PWA / offline | `vite-plugin-pwa` + TanStack Query cache persisted to IndexedDB |
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
- Song → setlist with block → gig
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
3. Gigs with venues, contacts, booking + payment status
4. Setlists (sets, blocks, songs), clone, show mode
5. Stage-floor PDF export (one page per set)
6. Search
7. Offline read-only
8. Archive + audit trail (from day one: every write goes through one place)

## Backlog

- **Excel export (first up after MVP)**, then Numbers / CSV (setlist, repertoire, gig overview)
- Band invites by members
- Member availability per gig
- Other PDFs (band/sound engineer setlist with key/BPM, gig sheet)
- Custom song fields per band
- Lead singer per song
- Per-song notes in a setlist ("longer intro tonight")
- Account linking
- Generated tech rider / stage plot / input list
- Notifications (push / email)
- In-app user manual, auto-updated using skills
- Money: fees per gig, totals per year
