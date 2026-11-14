# Events

The term is **events** (URL `/<band>/events/<slug>`).

- Title, date, optional start and end time (an end before the start is the next day), files. Other times (load-in, soundcheck) go in the free-form notes.
- Slug: slugified title; if taken, the date in front (`2026-12-05-agnietenhof`), only then `-2`.
- Linked **venue** (own record, reusable)
- Linked **contact(s)** (own record, reusable)
- Picking a date that already has another event (not cancelled, not archived; times ignored) shows a non-blocking warning under the date field, linking to those events.
- Venue and contacts are **search boxes** in the event form. A new name creates the venue/contact right there (a “+ New …” row in the dropdown), without leaving the form. Picking a venue suggests the contacts used last time at that venue.
- Band start page = upcoming events. Past events are behind a filter.
- One filter menu on the events list: upcoming/past, statuses, mine/everyone. Mine = you're on the event's list of people and didn't answer *no* (see [availability.md](availability.md)).
- Two independent statuses:

| Field   | Values                                                 |
|---------|--------------------------------------------------------|
| Booking | `lead → option → confirmed` (+ `cancelled`)            |
| Payment | `open → invoiced → paid`                               |

  Paid upfront = `confirmed` + `paid`. Paid afterwards = past `confirmed` + `invoiced`. Played is implicit: a confirmed event in the past.
- Free tags for anything else.
- Song and event notes render as markdown (GFM, no raw HTML).
- Event page: the venue name links to the venue's page. Each contact shows just the name; tapping it opens a pop-up with phone, email and organisation, plus Call · WhatsApp · Mail (only for the filled fields) and a "View contact" link to the contact's page. A contact with neither phone nor email links straight to that page.
- Contacts list (settings): tapping a phone number asks: call or WhatsApp.
- An event has one setlist (see [setlists.md](setlists.md)), chosen or copied in the event form.
- People: the event form has a checklist of the band's members and readers; their availability is shown on the event. See [availability.md](availability.md).

## Calendar feed

Settings → Calendar gives each person a private link per band to subscribe to in Google or Apple Calendar. It has options (tentative, “(option)” in front), and confirmed events from the past year on; the description has the notes and a link to the event. A start without an end lasts 3 hours. Google's one-click subscribe doesn't accept prefilled links, so “Add to Google Calendar” copies the link and opens Google's “From URL” page.
