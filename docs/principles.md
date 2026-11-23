# Principles, hosting, languages, UX

An open source tool that helps bands plan events, setlists and technical riders.

Installable PWA. Everything must be readable on a mobile phone, also offline.

## Principles

- **Simple authorisation.** Two roles, no band admin.
- **Archive, never delete.** Every record has `archived_at`; every change is logged (audit trail), so it's always visible who changed what and what it was before.
- **No band specifics in code.** gigg.band is just one instance.
- **Easy to self-host on Vercel.** Clear guide (see the README); free tiers should be enough for a single band.
- **No external services where avoidable** (feedback, search, etc. live in the app).

## Hosting

- gigg.band is **invitation only** at the start, to keep costs down.
- **Not in search engines.** Every page has `<meta name="robots" content="noindex, nofollow">` (`src/routes/__root.tsx`) and Vercel sends `X-Robots-Tag: noindex, nofollow` on every response (`vercel.json`). The marketing page (`marketing/`) has the same meta tag. Remove all three at launch.
- Anyone can self-host: deploy to Vercel, link a database, set env vars, done.

## Languages

English and Dutch (informal *je*). Each user has a language, changeable in Settings; someone invited gets the inviter's. Signed out, the browser's language decides. Emails, the emailed availability page and the calendar feed use the recipient's language; history is written in the viewer's. URLs, user content and stored values stay as they are. A third language is one more dictionary file.

## UX

- Destructive actions confirm in our own dialog, not the browser's `confirm()`.
- No overscroll bounce or pull-to-refresh (it feels like an app).
- Mobile events list shows date · time on one line; the event view breaks only between them.
- Add buttons are icon-only on phones, beside their heading.
