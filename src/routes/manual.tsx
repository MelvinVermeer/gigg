import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'

export const Route = createFileRoute('/manual')({ component: Manual })

// Keep it short: one paragraph per topic. Update when a feature changes.
const rootRoute = getRouteApi('__root__')

function Manual() {
  const bands = rootRoute.useLoaderData()?.bands ?? []
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1>Manual</h1>

      <h2 className="mt-8">Songs</h2>
      <p className="leading-7 text-muted-foreground">
        Your repertoire: title, duration, key, BPM, tuning, notes and tags. Attach lyrics, charts or recordings as files on the
        song page (up to 100 MB each).
      </p>

      <h2 className="mt-8">Events</h2>
      <p className="leading-7 text-muted-foreground">
        A gig with a date, a venue and contacts. Type a new venue or contact in the form to create it on the spot. Booking
        (lead → option → confirmed → played) and payment (open → invoiced → paid) are separate, so you can find "played but not
        paid". Files such as contracts or riders go on the event page.
      </p>

      <h2 className="mt-8">Setlists</h2>
      <p className="leading-7 text-muted-foreground">
        Open an event and build its setlist from sets, songs and blocks. A block (an acoustic bit, an encore) is a reusable
        group of songs; adding one copies its songs, so changing the block later doesn't touch old setlists. Move songs with ↑
        and ↓. Every change saves at once. Setlists without an event live under Setlists.
      </p>

      <h2 className="mt-8">On stage</h2>
      <p className="leading-7 text-muted-foreground">
        <strong>Show mode</strong> shows the setlist full-screen in big type, one song at a time; swipe for the next. The screen
        stays on. <strong>Print</strong> gives one A4 page per set for the stage floor.
      </p>

      <h2 className="mt-8">Offline</h2>
      <p className="leading-7 text-muted-foreground">
        Pages you have opened are kept on your phone and can be read without a signal. Upcoming gigs and their setlists are
        saved automatically. You can't change anything offline.
      </p>

      <h2 className="mt-8">Search</h2>
      <p className="leading-7 text-muted-foreground">The search box at the top finds songs, events, venues and contacts, and forgives typos.</p>

      <h2 className="mt-8">People</h2>
      <p className="leading-7 text-muted-foreground">
        A <strong>member</strong> can change everything and invite others; a <strong>reader</strong> can only look. Invite
        people under Settings → Members; they get an email and sign in with it, or with a passkey (add one under Settings).
        Anyone can be removed, and invited again later.
      </p>

      <h2 className="mt-8">Archive and history</h2>
      <p className="leading-7 text-muted-foreground">
        Nothing is deleted: the Archive button at the bottom of an edit form hides an item, and nothing else in the app links
        to archived items. This is the only place to find them again: open one and press Edit, then Restore. Every edit
        page links to History, which shows who changed what, and what it was before.
      </p>
      {bands.map((b) => (
        <section key={b.slug} aria-label={`Archived items of ${b.name}`}>
          {bands.length > 1 && <h3>{b.name}</h3>}
          <ul className="mt-3 grid gap-1 text-sm">
            <li>
              <Link to="/$band/songs" params={{ band: b.slug }} search={{ archived: true }}>
                Archived songs
              </Link>
            </li>
            <li>
              <Link to="/$band/events" params={{ band: b.slug }} search={{ when: 'archived' }}>
                Archived events
              </Link>
            </li>
            <li>
              <Link to="/$band/setlists" params={{ band: b.slug }} search={{ archived: true }}>
                Archived setlists
              </Link>
            </li>
            <li>
              <Link to="/$band/blocks" params={{ band: b.slug }} search={{ archived: true }}>
                Archived blocks
              </Link>
            </li>
            <li>
              <Link to="/$band/settings/venues" params={{ band: b.slug }} search={{ archived: true }}>
                Archived venues
              </Link>
            </li>
            <li>
              <Link to="/$band/settings/contacts" params={{ band: b.slug }} search={{ archived: true }}>
                Archived contacts
              </Link>
            </li>
          </ul>
        </section>
      ))}

      <h2 className="mt-8">Feedback</h2>
      <p className="leading-7 text-muted-foreground">Found a bug or missing something? Use Feedback in the account menu.</p>
    </main>
  )
}
