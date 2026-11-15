# Availability

An event has one list of people: its **participants**. Each has a state: **not asked → waiting → yes / maybe / no**.

- Anyone in the band (members and readers) can be a participant. The event page always has a **Participants** field: the number of participants, with the availability pill once someone was asked (one rounded bar with a number per status: green yes, amber maybe, red no, grey waiting), or **Select**. Clicking it opens a dialog with everyone's state, sorted yes > maybe > no > waiting > not asked: members tick people on or off (with **Select all**), saved right away, ask availability, and close or reopen the check; readers see it read-only. The new-event form has the same field (saved with the event; Ask availability there saves, then asks). The edit form has none. An event can be saved without participants (leads, rehearsals, …). Adding sends nothing, so new people are *not asked*.
- Participants decide who the event is for: it shows on their home page (**Mine**), and always on its creator's. Everyone can still see every event via the filter.
- **Ask availability** emails every participant still *not asked*; they become *waiting*. Waiting or answered people aren't emailed again. **Ask** next to one person (in the dialog) asks just them: someone not asked yet, or asked before the event moved.
- The check is **open** once someone was asked. **Close availability check** stops all answering: the card disappears and the emailed links say the check is closed. **Reopen** brings both back (answers kept, nobody mailed); asking someone also reopens it.
- Adding someone while the check is open asks in the dialog: “Do you also want to check availability with this person?” Yes asks them.
- The **Availability** card on the event is only for your own answer: shown while the check is open and you're a participant.
- The email has a link to a page (`/availability/<token>`, in the recipient's language) where they answer without logging in. One token per person per ask; only its hash is stored. Everyone answers only for themselves.
- Answers: yes / maybe / no (coloured). A note can be added on *maybe* only; it shows in the Participants dialog. An answer can be changed (Edit in the card, or the same link) while the check is open.
- If the event moves after someone was asked, their answer shows as *moved since* and **Ask** appears next to them again (asking again clears their answer).
- Removing someone (participants dialog) removes their answer and their link stops working; added again, they start over at *not asked*.
- Adding, removing, asking, answering, closing and reopening show up in [history](history.md).
- **Mine** in the events filter (the default) = you're a participant (whatever you answered) or you created the event.
