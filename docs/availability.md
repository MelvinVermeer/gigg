# Availability

An event has one list of people. Each has a state: **not asked → waiting → yes / maybe / no**.

- Anyone in the band (members and readers) can be on the list. Members put people on it in the event form, a checklist of the band; adding sends nothing, so new people are *not asked*.
- **Check availability** (members) emails everyone still *not asked*; they become *waiting*. Waiting or answered people aren't emailed again. **Ask** next to one person asks just them, any time.
- The email has a link to a page (`/availability/<token>`, in the recipient's language) where they answer without logging in. One token per person per ask; only its hash is stored. Someone on the list can also answer on the event page. Everyone answers only for themselves.
- Answers: yes / maybe / no (coloured). A note can be added on *maybe* only. An answer can always be changed (Edit by your name, or the same link); there is no closing.
- Shown on the event, sorted yes > maybe > no > waiting > not asked.
- If the event moves after someone was asked, their answer shows as *moved since* and **Ask** appears next to them again (asking again clears their answer).
- Removing someone (event form) removes their answer and their link stops working.
- Adding, removing, asking and answering show up in [history](history.md).
- **Mine** in the events filter = you're on the list and didn't answer *no*.
