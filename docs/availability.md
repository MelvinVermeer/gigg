# Availability

An event has one list of people: its **participants**. Each has a state: **not asked → waiting → yes / maybe / no**.

- Anyone in the band (members and readers) can be a participant. The event form has a **Participants** field: closed it sums up who's on it (new events start with nobody, so you think about who it's for); opened it's a checklist of the band with **Select all**. An event can be saved without participants (leads, rehearsals, …). Adding sends nothing, so new people are *not asked*.
- Participants decide who the event is for: it shows on their home page (**Mine**), and always on its creator's. Everyone can still see every event via the filter.
- **Ask availability** in the opened participant list saves the form and then emails every participant still *not asked* (same as Check availability on the event page).
- Adding someone in the form after asking has started (anyone on the event was asked) asks: “Do you also want to check availability with this person?” Yes asks them once the form is saved.
- **Check availability** (members) emails everyone still *not asked*; they become *waiting*. Waiting or answered people aren't emailed again. **Ask** next to one person asks just them, any time.
- The email has a link to a page (`/availability/<token>`, in the recipient's language) where they answer without logging in. One token per person per ask; only its hash is stored. Someone on the list can also answer on the event page. Everyone answers only for themselves.
- Answers: yes / maybe / no (coloured). A note can be added on *maybe* only. An answer can always be changed (Edit by your name, or the same link); there is no closing.
- Shown on the event, sorted yes > maybe > no > waiting > not asked.
- If the event moves after someone was asked, their answer shows as *moved since* and **Ask** appears next to them again (asking again clears their answer).
- Removing someone (event form) removes their answer and their link stops working; added again, they start over at *not asked*.
- Adding, removing, asking and answering show up in [history](history.md).
- **Mine** in the events filter (the default) = you're a participant (whatever you answered) or you created the event.
