# Gigg: ideas

Backlog only. What's built is described in [docs/](docs/).

## Next

- **Excel export (first up)**, then Numbers / CSV (setlist, repertoire, event overview)
- **Download everything upcoming**: one tap to save all upcoming events, setlists and their songs (and later files) to the device, for offline use without visiting each page

## Backlog

- **Public share links per file**: token-based, revocable (the `share_token` column exists, no UI or route yet)
- Band-level files (not attached to a song or event)
- Other PDFs (band/sound engineer setlist with key/BPM, event sheet)
- Custom song fields per band
- Lead singer per song
- Per-song notes in a setlist ("longer intro tonight")
- Account linking
- Generated tech rider / stage plot / input list
- Notifications (push / email)
- Keep the in-app manual (`/manual`) up to date automatically using skills
- Band invites by members (creating a band is admin only for now)
- Feedback: optional push to GitHub Issues via backend API (users don't need a GitHub account); GitHub Issues should not show factory-related labels
- Privacy: anonymise a user record when someone leaves
- Styled invite emails: HTML with branding instead of plain text
- Tests: accessibility check per page (`@axe-core/playwright`), public file link works then is revoked, smoke test against the Vercel preview deploy
- Setlist edit: drag and drop in blocks doesn't work yet, and the edit view doesn't feel right

## From feedback (2026-11-12)

Each of these needs a **grill-me session** before building: the open questions get settled first.

- **C. Non-availability ahead of time.** Log holidays and blocked dates up front, maybe pre-filling answers when you're put on an event. (Done: an event has one list of people with an availability state each, see docs/availability.md.)
- **A. Event filtering and default view.** By default show only confirmed gigs you're part of; remember the chosen view per user or device. The same filter for the iCal feed ("only my events/gigs"). ("Part of" = on the event's people, not answered no.) (A filter menu exists; the default and the remembering don't.)
- **B. Event types and money.** Event types such as *repetitie* (rehearsal) besides gigs. A fee field (*vergoeding*) per event, with free events as an empty or zero fee; later, totals per year. Open: which fields (booking/payment status, fee) apply to which type.
- **D. Setlists and songs.** Personal notes per song, visible only to you (different from per-song notes in a setlist). A setting for which song fields a setlist shows (key, BPM, duration…), tied in with the other PDFs.
