# Events

The term is **events** (URL `/<band>/events/<slug>`).

- Title, date, optional start and end time (an end before the start is the next day), files. Other times (load-in, soundcheck) go in the free-form notes.
- Slug: slugified title; if taken, the date in front (`2026-12-05-agnietenhof`), only then `-2`.
- Linked **venue** (own record, reusable)
- Linked **contact(s)** (own record, reusable)
- Picking a date that already has another event (not cancelled, not archived; times ignored) shows a non-blocking warning under the date field, linking to those events.
- **Other bands**: someone who is a participant of another band's event that day (not cancelled, not archived, and they didn't answer no) gets a non-blocking warning: “Melvin already has an event for another band on this date.” Never which band or event. In the new-event form under Participants (for the ticked people), in the edit form under the date (for the event's participants), and in the participants dialog next to their name (“Event in another band”). The person themselves isn't told.
- Venue and contacts are **search boxes** in the event form. A new name creates the venue/contact right there (a “+ New …” row in the dropdown), without leaving the form. Picking a venue suggests the contacts used last time at that venue.
- Band start page = upcoming events. Past events are behind a filter.
- One filter menu on the events list: upcoming/past, statuses, mine/everyone. Mine = you're one of the event's participants or you created it (see [availability.md](availability.md)).
- Two independent statuses:

| Field   | Values                                                 |
|---------|--------------------------------------------------------|
| Booking | `lead → option → confirmed` (+ `cancelled`)            |
| Payment | `open → invoiced → paid` (+ `free`)                    |

  Paid upfront = `confirmed` + `paid`. Paid afterwards = past `confirmed` + `invoiced`. Played is implicit: a confirmed event in the past.
- **Fee**: free text under Payment (“€450 + drinks”), also with `free`.
- Event page: venue, contacts, fee and tags are left out when empty.
- Free tags for anything else.
- Song and event notes render as markdown (GFM, no raw HTML).
- Event page: the venue name links to the venue's page. Each contact shows just the name; tapping it opens a pop-up with phone, email and organisation, plus Call · WhatsApp · Mail (only for the filled fields) and a "View contact" link to the contact's page. A contact with neither phone nor email links straight to that page.
- Contacts list (settings): tapping a phone number asks: call or WhatsApp.
- An event has one setlist (see [setlists.md](setlists.md)), chosen or copied in the event form.
- Participants: a field on the event page (and in the new-event form) that opens a dialog to add and remove band members and readers and ask their availability. See [availability.md](availability.md).

## Calendar feed

Settings → Calendar gives each person a private link per band to subscribe to in Google or Apple Calendar. It has options (tentative, “(option)” in front), and confirmed events from the past year on; the description has the notes and a link to the event. A start without an end lasts 3 hours. Google's one-click subscribe doesn't accept prefilled links, so “Add to Google Calendar” copies the link and opens Google's “From URL” page.
