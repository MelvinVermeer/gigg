# Testing

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
- Reader sees no edit buttons
- Mobile profiles (iPhone/WebKit, Pixel/Chromium)

**Left out for now:** component tests, screenshot comparisons, coverage thresholds.

**CI (GitHub Actions)** on every PR and every push to `main`: type check → Vitest → build → Playwright. No database service needed.
