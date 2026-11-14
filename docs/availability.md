# Availability

An event has one list of people: its **participants**. Each has a state: **not asked → waiting → yes / maybe / no**.

- Anyone in the band (members and readers) can be a participant. The event page always has a **Participants** field: the number of participants (with coloured answer counts once someone was asked, e.g. 2 yes · 1 maybe · 1 waiting) or **Select**. Clicking it opens a dialog: members tick people on or off (with **Select all**), saved right away, and **Ask availability**; readers see who's on it. The new-event form has the same field (saved with the event; Ask availability there saves, then asks). The edit form has none. An event can be saved without participants (leads, rehearsals, …). Adding sends nothing, so new people are *not asked*.
- Participants decide who the event is for: it shows on their home page (**Mine**), and always on its creator's. Everyone can still see every event via the filter.
- **Ask availability** emails every participant still *not asked*; they become *waiting*. Waiting or answered people aren't emailed again.
- Adding someone after asking has started asks in the dialog: “Do you also want to check availability with this person?” Yes asks them.
- The **Availability** card on the event appears once someone was asked: everyone with their state, notes, *moved since*, and **Ask** next to one person to ask just them.
- The email has a link to a page (`/availability/<token>`, in the recipient's language) where they answer without logging in. One token per person per ask; only its hash is stored. A participant can also answer on the event page (once asking has started). Everyone answers only for themselves.
- Answers: yes / maybe / no (coloured). A note can be added on *maybe* only. An answer can always be changed (Edit by your name, or the same link); there is no closing.
- Shown on the event, sorted yes > maybe > no > waiting > not asked.
- If the event moves after someone was asked, their answer shows as *moved since* and **Ask** appears next to them again (asking again clears their answer).
- Removing someone (participants dialog) removes their answer and their link stops working; added again, they start over at *not asked*.
- Adding, removing, asking and answering show up in [history](history.md).
- **Mine** in the events filter (the default) = you're a participant (whatever you answered) or you created the event.
