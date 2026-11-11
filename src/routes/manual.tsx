import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/manual')({ component: Manual })

// Keep it short: one paragraph per topic. Update when a feature changes.
function Manual() {
  return (
    <main>
      <h1>Manual</h1>

      <h2>Songs</h2>
      <p>
        Your repertoire: title, duration, key, BPM, tuning, notes and tags. Attach lyrics, charts or recordings as files on the
        song page (up to 4 MB each).
      </p>

      <h2>Events</h2>
      <p>
        A gig with a date, a venue and contacts. Type a new venue or contact in the form to create it on the spot. Booking
        (lead → option → confirmed → played) and payment (open → invoiced → paid) are separate, so you can find "played but not
        paid". Files such as contracts or riders go on the event page.
      </p>

      <h2>Setlists</h2>
      <p>
        Open an event and build its setlist from sets, songs and blocks. A block (an acoustic bit, an encore) is a reusable
        group of songs; adding one copies its songs, so changing the block later doesn't touch old setlists. Move songs with ↑
        and ↓. Every change saves at once. Setlists without an event live under Setlists.
      </p>

      <h2>On stage</h2>
      <p>
        <strong>Show mode</strong> shows the setlist full-screen in big type, one song at a time; swipe for the next. The screen
        stays on. <strong>Print</strong> gives one A4 page per set for the stage floor.
      </p>

      <h2>Offline</h2>
      <p>
        Pages you have opened are kept on your phone and can be read without a signal. Upcoming gigs and their setlists are
        saved automatically. You can't change anything offline.
      </p>

      <h2>Search</h2>
      <p>The search box at the top finds songs, events, venues and contacts, and forgives typos.</p>

      <h2>People</h2>
      <p>
        A <strong>member</strong> can change everything and invite others; a <strong>reader</strong> can only look. Invite
        people under Settings → Members; they get an email and sign in with it, or with a passkey (add one under Settings).
        Anyone can be removed, and invited again later.
      </p>

      <h2>Archive and history</h2>
      <p>
        Nothing is deleted: Archive hides an item and you can restore it. Every edit page links to History, which shows who
        changed what, and what it was before.
      </p>

      <h2>Feedback</h2>
      <p>Found a bug or missing something? Use Feedback in the account menu.</p>
    </main>
  )
}
