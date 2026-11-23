# Get to know gigg

`/<band>/welcome` (`src/routes/$band.welcome.tsx`): a short list introducing the main features. It informs; nothing is required. Sign-up lands here; the user menu always links to it; the events page (upcoming) shows a slim bar "Get to know gigg · 3/9 →" until it's hidden.

- **Band items** (members only, in story order): plan an event, add songs, build a setlist, invite a bandmate, ask for availability. They tick themselves when the band has ≥1 event, ≥1 song, ≥1 setlist, >1 active membership, ≥1 event person asked, whoever did it. Counted in `getBand`, so it works offline from the cached read. Someone joining an existing band sees them already ticked.
- **Personal items** (everyone): passkey, calendar, notifications, and install on iPhone/iPad Safari when not opened as the app (other devices have the install banner). They tick on tapping their link or "Got it", and stay ticked in your other bands. No detection of whether you actually did it.
- **Hide** takes the bar off the events page for this band. The first time everything is ticked, the page says "All set" and hides the bar too.
- Item keys and the list: `src/lib/onboarding.ts`; ops `tickOnboarding` / `hideOnboarding`. Storage in [data-model.md](../data-model.md). Not in the history.
