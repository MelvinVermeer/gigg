# Spec: sign-up, song CSV import/export, "Get to know gigg"

Status: agreed in a grilling session (2026-11-23). Song CSV import/export is built (see `docs/songs.md`); the rest is not built yet. When built, the behaviour moves into `docs/` and this file goes.

## Problem Statement

A band can only start using gigg when the instance admin creates the band and invites its first member. Someone who hears about gigg can't just try it. And once a band is in, nothing tells new people what gigg can do: they land on an empty events page, have to type in their whole repertoire song by song, and may never find features like the calendar feed, passkeys or notifications.

## Solution

- **Self-service sign-up**, behind an instance setting: email address + band name, nothing else. The magic link creates the band and signs you in.
- **A storage quota per band**, so an open instance can't be filled with files.
- **A privacy page**, required before sign-up is switched on.
- **Song CSV import with a column-mapping step**, plus a matching **CSV export**, so a band brings its repertoire in at once and can bulk-edit it as a round trip.
- **A "Get to know gigg" page** per band: a short list introducing the main features, with band items that tick themselves from the band's data and personal items you tick by tapping them. It informs; nothing on it is required.

## User Stories

### Sign-up

1. As a visitor of an instance with open sign-up, I want a "Start a band" link on the tagline page and the sign-in page, so that I find how to get started.
2. As a visitor, I want to sign up with only my email address and my band's name, so that starting takes seconds.
3. As a visitor, I want to see "check your mail" after submitting, so that I know what to do next.
4. As a visitor, I want my band to be created only when I click the link in the email, so that nobody can create bands under my email address.
5. As a visitor, I want the link to work on another device than the one I signed up on, so that I can open it on my phone.
6. As a new member, I want to land on my band's "Get to know gigg" page after clicking the link, so that I know where to begin.
7. As a new member, I want to be offered a passkey after that first sign-in, so that signing in later is faster (existing prompt).
8. As a new member, I want my language to follow my browser, so that gigg speaks my language without asking.
9. As a new member, I want my band's URL made from the band name, numbered when it's taken, so that I don't have to choose one.
10. As someone who already has an account, I want signing up with a new band name to add that band to my account, so that I can run a second band with the same login.
11. As someone signing up, I want the form to respond the same whether or not my email has an account, so that the form doesn't reveal who uses gigg.
12. As a visitor of an instance with sign-up off, I want no sign-up link anywhere, so that I don't hit a dead end.
13. As the instance admin, I want sign-up off by default and switched on with one setting, so that I decide when the instance opens up.
14. As a self-hoster, I want the same setting, so that I can open or close sign-up on my own instance.
15. As the instance admin, I want to keep creating bands from the admin page as now, so that invite-only bands still work.
16. As a visitor, I want to see a line under the sign-up button linking to the privacy statement, so that I know what happens with my data.

### Privacy

17. As a visitor, I want a privacy page explaining which data is stored, where, that there's no tracking, and how to get it deleted, so that I can trust the instance.
18. As a self-hoster, I want the privacy page to use my instance's contact address, so that I can reuse it without editing code.
19. As a Dutch-speaking visitor, I want the privacy page in Dutch, so that I understand it.

### Storage quota

20. As the instance admin, I want one setting for the maximum storage per band, so that file uploads can't run up my costs.
21. As a self-hoster, I want no limit when the setting isn't set, so that nothing changes for me unless I choose to.
22. As a member, I want to see how much of the band's storage is used ("340 MB of 1 GB") in band settings, so that I know where we stand.
23. As a member, I want an upload that doesn't fit to be refused before it starts, with "This band's storage is full", so that I don't wait for an upload that fails.
24. As the instance admin, I want the quota to apply to every band, existing ones too, so that there's one rule.

### Song CSV import

25. As a member, I want an Import button on the songs page, so that I can bring in my repertoire at once.
26. As a member of a band with no songs, I want the empty songs page to offer the import, so that I see it at the right moment.
27. As a member, I want to upload a CSV file or paste text, so that I can import from a file or straight from a spreadsheet.
28. As a member, I want comma-, semicolon- and tab-separated files to all work, so that exports from Excel, Numbers and Google Sheets import without fuss.
29. As a member, I want columns recognised by their header in English or Dutch, including common synonyms (song, naam, tempo, duur…), so that most files need no work.
30. As a member, I want columns named after our custom song fields recognised too, so that a re-import of an export maps fully.
31. As a member, I want to always see a mapping step before anything is imported, so that I know what will happen to my 80 songs.
32. As a member, I want each column shown with its guessed field and the value from one example song (the row with the most cells filled), so that I can judge the guess.
33. As a member, I want to map a column to one of our fields, to a new custom field, to "add to notes", or to skip it, so that no data is lost or forced into the wrong place.
34. As a member, I want a new custom field to be named after the column header, so that I don't have to type it.
35. As a member, I want "add to notes" to keep which column the value came from, so that notes stay readable.
36. As a member, I want to be stopped when no column is mapped to the title, so that I don't create songs without names.
37. As a member, I want to choose what happens to songs that already exist (skip, fill in empty fields, overwrite), defaulting to skip, so that a first import is safe and a re-import is useful.
38. As a member, I want existing songs matched on title ignoring case and spaces, archived songs included, so that I don't get duplicates.
39. As a member, I want an archived song that matches to stay archived and be skipped, so that restoring stays a deliberate act.
40. As a member, I want duplicate titles within the file to count once (the first wins), so that a messy file doesn't create doubles.
41. As a member, I want durations like 3:45, 1:02:30 or 225 (seconds) understood, so that common formats just work.
42. As a member, I want BPM like 120 or "120 bpm" understood, so that common formats just work.
43. As a member, I want tags split on commas and pipes and stored lowercase, so that they match tags made in the app.
44. As a member, I want multi-line notes and lyrics in quoted cells kept intact, so that nothing gets cut.
45. As a member, I want to see per column, before importing, how many values aren't understood with an example, so that I can map that column to notes instead or fix my file.
46. As a member, I want songs with a value that isn't understood still imported with that field left empty, so that one bad cell doesn't stop the import.
47. As a member, I want a summary after the import (created, updated, skipped, values not understood per song), so that I know what happened.
48. As a member, I want the whole import to be one change in the history, so that I can see who imported what and what it was before.
49. As a reader, I want no Import button, so that I'm not offered something I can't do.
50. As a member offline, I want the import unavailable like other edits, so that nothing gets half-saved.

### Song CSV export

51. As a member or reader, I want an Export CSV action on the songs page, so that I can take the repertoire to a spreadsheet.
52. As a member, I want the export to use the same columns the import recognises (all fixed fields, custom fields by name, tags joined with commas), so that export → edit → import with "overwrite" works as a bulk edit.
53. As a member, I want the export to open well in Excel (same format as the setlist CSV), so that I don't have to fiddle with import settings.

### Get to know gigg

54. As a new member, I want a "Get to know gigg" page for my band, so that I learn what gigg can do.
55. As a member, I want a slim bar on the events page ("Get to know gigg · 3/9 →"), so that I can find it without it pushing my gigs down.
56. As a member, I want a "Get to know gigg" item in the user menu, so that I can open it again any time, also after hiding it.
57. As a member, I want band items: plan an event, add songs (or import), build a setlist for your event, invite a bandmate, ask for availability, in that order, so that they follow a real story: Saturday's gig, what we play, who comes.
58. As a member, I want band items to tick themselves when the band has done them, whoever did it, so that I'm not told to do what's done.
59. As a reader, I want no band items, so that I'm not shown things I can't do.
60. As anyone in a band, I want personal items: sign in faster with a passkey, your gigs in your own calendar, get a notification when you're asked, so that I learn the features that are about me.
61. As an iPhone/iPad user who hasn't installed gigg, I want an item explaining how to install it, so that I get offline use; on other devices the existing install banner covers this.
62. As a member, I want every item to have one line of explanation and a link to where the feature lives, so that I can try it straight away.
63. As a member, I want tapping an item's link or its "Got it" to tick it, so that I can dismiss an item without leaving the page.
64. As someone in two bands, I want personal items I ticked to stay ticked in my other band, so that I don't see them twice.
65. As a member, I want a Hide button, so that the bar disappears when I'm not interested.
66. As a member, I want an "All set" moment the first time everything is ticked, after which the bar disappears, so that it ends on a good note.
67. As an existing member when this ships, I want to see it too, so that I discover features I may have missed.
68. As someone who joins an existing band, I want the band items already ticked, so that I effectively see only what's new to me.

## Implementation Decisions

### Sign-up

- **Instance setting** `OPEN_SIGNUP` (env var, off when unset). Off: no links, the sign-up route is a 404. On: links on the tagline page and the sign-in page, sign-up route works.
- **Auth:** the user-create hook that now only allows admin emails also allows anyone when sign-up is on. The magic-link sender sends to any email when sign-up is on (same response either way).
- **Band creation after verification:** the sign-up form requests a magic link whose callback carries the band name. Clicking it signs in (creating the user if new) and the callback route creates the band and the membership by reusing the existing band creation (slug picking, reserved slugs, numbered on collision), then redirects to the band's welcome page. Magic links are single-use, so a double click can't create two bands.
- **Existing account:** the same path; the band is added to that account.
- **New user defaults:** empty display name, locale from the browser (as for admins today).
- **Privacy page:** static, translated (en/nl) like the manual; contact address from an env var. One line under the sign-up button links to it, no checkbox. Covers: data stored (email, band data, files), where (Vercel/Neon, Frankfurt), no tracking, deletion on request by email (anonymisation is still on the backlog).

### Storage quota

- **Setting** `BAND_STORAGE_LIMIT_MB` (unset = no limit; gigg.band: 1024), applies to every band.
- **Enforced when the upload token is requested**, which already happens before the browser uploads to Blob: the band's current total (already computed for the admin page) plus the declared size must fit, else a clear error. No per-band override.
- **Band settings** shows usage against the limit when a limit is set.

### Song CSV import / export

- **Pure CSV module** (shared by client and server, next to the existing setlist CSV): parse (delimiter detection `,` `;` tab, BOM, quoted multi-line cells), guess a field per header (EN/NL names + synonyms + the band's custom field names, compared ignoring case, spaces and punctuation), pick the example row (most non-empty cells), and convert values per field (duration, BPM, tags) reporting values not understood. The same module writes the export.
- **Mapping step is client-side** on the parsed file: per column a target of `field:<key>` | `custom:<id>` | `new-custom:<header>` | `notes` | `skip`, plus one existing-songs choice `skip` | `fill` | `overwrite` (default `skip`). Warnings per column come from the same conversion the server runs.
- **One band op `importSongs`** (member only, one transaction, so one tx in the history) taking the rows, the mapping and the existing-songs choice. It creates new custom fields, matches titles (case-insensitive, trimmed, archived included; archived matches are skipped), applies skip/fill/overwrite (empty cells never clear a field), dedupes within the file (first wins), creates the rest, and returns a summary: created, updated, skipped, not-understood values per song.
- **"Add to notes"** appends `Header: value` lines to the song's notes.
- **Export** is a read op returning the band's active songs in the format above (semicolons, BOM, like the setlist CSV), open to readers.

### Get to know gigg

- **Route** `/<band>/welcome`; the sign-up callback redirects there; slim bar on the events page; item in the user menu.
- **Items** have stable keys. Band items (members only): `event`, `songs`, `setlist`, `invite`, `availability`, done when the band has ≥1 event, ≥1 song, ≥1 setlist, >1 active membership, ≥1 event person who was asked. Personal items (everyone): `passkey`, `calendar`, `notifications`, and `install` only on iOS when not running standalone (client-side check).
- **Schema** (one incremental migration):
  - `memberships.onboarding_hidden_at` (nullable): the Hide button and the "All set" end.
  - `users.onboarding_seen` (text array of personal item keys): ticked by link tap or "Got it".
  - Neither is audited (personal view state, like shown fields).
- **Band item status is computed** in the band read (counts), so it also works offline from the cached read.
- **Existing members** see it after the migration (no backfill of hidden).

## Testing Decisions

A good test checks behaviour through the public seam (what an op returns and what ends up in the database, or what a user sees in the browser), not internals.

Seams (all existing):

1. **Band ops against PGlite (Vitest)**, the main seam, prior art in the existing ops tests:
   - `importSongs`: creates songs; skip / fill / overwrite; archived matches skipped; in-file duplicates; new custom fields; notes appending; values not understood left empty and reported; one tx in `changes` with the right user.
   - The generic outsider/reader authorisation tests pick up the new ops automatically.
   - Onboarding status: band items flip with data; personal ticks shared across bands; hide.
   - Sign-up band creation: new account and existing account both end with a membership in a new band.
   - Quota: upload token refused when over the limit, allowed without a limit.
2. **Pure CSV module (Vitest)**, prior art in the setlist CSV tests: delimiter detection, BOM, quoted multi-line cells, header guessing (EN/NL/synonyms/custom), example row, duration/BPM/tags conversion, export → parse round trip.
3. **Playwright (one critical journey)**, prior art in the login spec with the test-mode outbox: with sign-up on, sign up with email + band name → open the mailed link → land on the welcome page of the new band → import a small CSV through the mapping step → the songs item is ticked.

## Out of Scope

- Waitlist, invite codes, or a cap on bands per account.
- Per-band quota override.
- Terms of use.
- Sample/demo data, product tours, tooltips, welcome emails.
- Excel (.xlsx) import/export: CSV only.
- Detecting whether the calendar feed is actually subscribed or the app installed elsewhere: personal items tick on tap.
- Self-service account deletion / anonymisation (stays on the backlog; the privacy page says "email us").
- "Band invites by members": members can already invite; creating bands is what sign-up adds.

## Further Notes

- Before switching `OPEN_SIGNUP` on for gigg.band: the privacy page must be live, and check that no current band is already above 1 GB (else their uploads stop).
- `docs/principles.md` says gigg.band is invitation only; update it to "sign-up is an instance setting, off on gigg.band at the start" when this ships, and update `docs/auth.md` ("creating a band is admin only").
- Remove the matching items from `idea.md` (Excel/CSV export partly, band invites by members) when built.
