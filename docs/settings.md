# Settings

One page per band: `/<band>/settings`, reached from the user menu (avatar with the first letter of the email or display name; also: bands (switch), manual, feedback, log out).

- **You:** "Signed in as" always shows the email. Display name (shown instead of the email everywhere else) auto-saves on blur or Enter when changed, with a brief inline "Saved" or the error; empty clears it. Then passkeys (add, list, delete via a bin icon), theme (Light / Dark / System segmented control; per device, in a cookie), language (select with flags), calendar feed link (see [events.md](events.md)).
- **The band** (members): venues and contacts. Rarely change, so they're listed here, not in the main navigation. Each list links to the record's page, with an archived filter and "used in N events".
- **Venue page** `/<band>/venues/<slug>`: address (opens Google Maps in a new tab), notes (markdown), its events newest first. **Contact page** `/<band>/contacts/<id>`: organisation, phone (call / WhatsApp pop-up), email (mailto), notes (markdown), its events newest first. Readers see them too; members get an Edit button (online only) to `…/edit`: the fields, Save, Archive/Restore, history. Archived ones show a notice, leave the event form's search boxes, but stay on old events and their pages keep working. A venue's slug stays the same when it's renamed.
- **Members** (members only): list, invite by email as member or reader (existing people get their role changed), remove (bin icon). Removing archives the membership; you can't remove yourself.
