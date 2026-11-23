# Gigg: ideas

Backlog only. What's built is described in [docs/](docs/).

## Next

- **Excel export**: event overview (setlist and repertoire CSV exist)
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

- **D. Setlists and songs.** Personal notes per song, visible only to you (different from per-song notes in a setlist). A setting for which song fields a setlist shows (key, BPM, duration…), tied in with the other PDFs.

- Editing contacts and venues: the edit button should switch to the save button when in edit mode (similar to how it is done on editing events). the history button should move below the rule (same as editing events).

- Payment: add option 'free', And add a 'fee' field, this can be free teskt. Below the payment field.

- If fields Venue / Contacts / Fee / Tags are empty, hide them in the display mode.

- Avalability, if someone answered maybe with a reason. This reason should be shown in the availability dialog.
