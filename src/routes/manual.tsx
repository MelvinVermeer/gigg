import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { currentBand } from '#/lib/current-band'
import type { Locale } from '#/lib/i18n'

export const Route = createFileRoute('/manual')({ component: Manual })

// Keep it short: one paragraph per topic. Update when a feature changes, in both languages.
const rootRoute = getRouteApi('__root__')

const P = ({ children }: { children: ReactNode }) => <p className="leading-7 text-muted-foreground">{children}</p>
const H = ({ children }: { children: ReactNode }) => <h2 className="mt-8">{children}</h2>

const text: Record<Locale, { title: string; archived: (band: string) => string; links: string[]; body: (archive: ReactNode) => ReactNode }> = {
  en: {
    title: 'Manual',
    archived: (band) => `Archived items of ${band}`,
    links: ['Archived songs', 'Archived events', 'Archived setlists', 'Archived blocks', 'Archived venues', 'Archived contacts'],
    body: (archive) => (
      <>
        <H>Songs</H>
        <P>
          Your repertoire: title, duration, key, BPM, tuning, notes and tags, plus extra fields your band adds under Settings → Songs (like “Lead
          vocal”). Which fields you see in setlists, show mode, print and Excel is up to you: Settings → Setlists. Attach lyrics, charts or recordings as files on the song page (up to 100 MB
          each). Notes on songs and events can use markdown: **bold**, *italic*, # headings, - lists, - [ ] checklists, links and tables.
        </P>
        <H>Events</H>
        <P>
          A gig with a date, a venue and contacts. Type a new venue or contact in the form to create it on the spot. Booking (lead → option → confirmed, or
          cancelled) and payment (open → invoiced → paid, or free) are separate, with the fee as free text; a confirmed event in the past was played. The filter on the events page
          switches between upcoming and past, picks statuses, and shows your own events (you're on the event's people and didn't answer no) or everyone's. Start and end times are optional; an end
          before the start means after midnight. Files such as contracts or riders go on the event page. To get the gigs in your own Google or Apple
          calendar, use Settings → Calendar.
        </P>
        <H>Setlists</H>
        <P>
          Open an event and build its setlist from sets, songs and blocks. A block (an acoustic bit, an encore) is a reusable group of songs; adding one
          copies its songs, so changing the block later doesn't touch old setlists. Move songs with ↑ and ↓. Every change saves at once. Setlists without
          an event live under Setlists.
        </P>
        <H>On stage</H>
        <P>
          <strong>Show mode</strong> shows the setlist full-screen in big type, one set per screen; swipe for the next. The screen stays on.{' '}
          <strong>Print</strong> gives one A4 page per set for the stage floor.
        </P>
        <H>Offline</H>
        <P>
          Pages you have opened are kept on your phone and can be read without a signal. Upcoming gigs and their setlists are saved automatically. You
          can't change anything offline.
        </P>
        <H>Search</H>
        <P>The search box at the top finds songs, events, venues and contacts, and forgives typos.</P>
        <H>People</H>
        <P>
          A <strong>member</strong> can change everything and invite others; a <strong>reader</strong> can only look. Invite people under Settings →
          Members; they get an email and sign in with it, or with a passkey (add one under Settings). Anyone can be removed, and invited again later.
          Someone you invite gets your language; everyone can change theirs under Settings.
        </P>
        <H>Archive and history</H>
        <P>
          Nothing is deleted: the Archive button at the bottom of an edit form hides an item, and nothing else in the app links to archived items. This is
          the only place to find them again: open one and press Edit, then Restore. Every edit page links to History, which shows who changed what, and
          what it was before.
        </P>
        {archive}
        <H>Feedback</H>
        <P>Found a bug or missing something? Use Feedback in the account menu.</P>
      </>
    ),
  },
  nl: {
    title: 'Handleiding',
    archived: (band) => `Gearchiveerde items van ${band}`,
    links: ['Gearchiveerde nummers', 'Gearchiveerde optredens', 'Gearchiveerde setlists', 'Gearchiveerde blokken', 'Gearchiveerde locaties', 'Gearchiveerde contacten'],
    body: (archive) => (
      <>
        <H>Nummers</H>
        <P>
          Je repertoire: titel, duur, toonsoort, BPM, stemming, notities en tags, plus extra velden die je band toevoegt onder Instellingen → Nummers
          (zoals “Leadzang”). Welke velden je ziet in setlists, showmodus, printen en Excel bepaal je zelf: Instellingen → Setlists. Voeg teksten, akkoordenschema's of opnames toe als bestanden op de pagina
          van het nummer (tot 100 MB per stuk). Notities bij nummers en optredens mogen markdown bevatten: **vet**, *cursief*, # kopjes, - lijstjes,
          - [ ] afvinklijstjes, links en tabellen.
        </P>
        <H>Optredens</H>
        <P>
          Een optreden met een datum, een locatie en contacten. Typ een nieuwe locatie of een nieuw contact in het formulier om die meteen aan te maken.
          Boeking (lead → optie → bevestigd, of geannuleerd) en betaling (open → gefactureerd → betaald) staan los van elkaar; een bevestigd optreden
          in het verleden is gespeeld. Met het filter op de optredenspagina wissel je tussen komende en eerdere optredens, kies je statussen, en zie je je eigen
          optredens (je staat bij de mensen van het optreden en zei geen nee) of die van iedereen. Begin- en eindtijd zijn optioneel; een eindtijd vóór de begintijd betekent na middernacht. Bestanden zoals contracten
          of riders zet je op de pagina van het optreden. Wil je de optredens in je eigen Google- of Apple-agenda? Gebruik Instellingen → Agenda.
        </P>
        <H>Setlists</H>
        <P>
          Open een optreden en bouw de setlist uit sets, nummers en blokken. Een blok (een akoestisch stuk, een toegift) is een herbruikbare groep nummers;
          een blok toevoegen kopieert de nummers, dus het blok later aanpassen verandert oude setlists niet. Verplaats nummers met ↑ en ↓. Elke wijziging
          wordt meteen opgeslagen. Setlists zonder optreden staan onder Setlists.
        </P>
        <H>Op het podium</H>
        <P>
          <strong>Showmodus</strong> toont de setlist schermvullend in grote letters, één set per scherm; veeg voor de volgende. Het scherm blijft aan.{' '}
          <strong>Printen</strong> geeft één A4 per set voor op de vloer.
        </P>
        <H>Offline</H>
        <P>
          Pagina's die je hebt geopend blijven op je telefoon staan en zijn zonder bereik te lezen. Komende optredens en hun setlists worden automatisch
          bewaard. Offline kun je niets wijzigen.
        </P>
        <H>Zoeken</H>
        <P>Het zoekvak bovenaan vindt nummers, optredens, locaties en contacten, ook met een typfout.</P>
        <H>Mensen</H>
        <P>
          Een <strong>lid</strong> kan alles wijzigen en anderen uitnodigen; een <strong>lezer</strong> kan alleen kijken. Nodig mensen uit onder
          Instellingen → Leden; ze krijgen een e-mail en loggen daarmee in, of met een passkey (toe te voegen onder Instellingen). Iedereen kan worden
          verwijderd en later opnieuw uitgenodigd. Wie je uitnodigt krijgt jouw taal; iedereen kan die zelf wijzigen onder Instellingen.
        </P>
        <H>Archief en geschiedenis</H>
        <P>
          Er wordt niets verwijderd: de knop Archiveren onderaan een bewerkformulier verbergt een item, en verder linkt niets in de app naar gearchiveerde
          items. Alleen hier vind je ze terug: open er een, kies Bewerken en dan Terugzetten. Elke bewerkpagina linkt naar Geschiedenis, waar je ziet wie
          wat heeft gewijzigd, en wat het daarvoor was.
        </P>
        {archive}
        <H>Feedback</H>
        <P>Een bug gevonden of mis je iets? Gebruik Feedback in het accountmenu.</P>
      </>
    ),
  },
}

function Manual() {
  const root = rootRoute.useLoaderData()
  const bands = root.user?.bands ?? []
  const m = text[root.locale]
  const [songs, events, setlists, blocks, venues, contacts] = m.links
  // The current band comes from a cookie; read it after mount, like `/` does, so the page stays cacheable.
  const [b, setBand] = useState<(typeof bands)[number]>()
  useEffect(() => setBand(currentBand(bands, document.cookie)), [bands])
  const archive = b && (
    <section aria-label={m.archived(b.name)}>
      <ul className="mt-3 grid gap-1 text-sm">
        <li>
          <Link to="/$band/songs" params={{ band: b.slug }} search={{ archived: true }}>
            {songs}
          </Link>
        </li>
        <li>
          <Link to="/$band/events" params={{ band: b.slug }} search={{ when: 'archived' }}>
            {events}
          </Link>
        </li>
        <li>
          <Link to="/$band/setlists" params={{ band: b.slug }} search={{ archived: true }}>
            {setlists}
          </Link>
        </li>
        <li>
          <Link to="/$band/setlists" params={{ band: b.slug }} search={{ archived: true }} hash="blocks">
            {blocks}
          </Link>
        </li>
        <li>
          <Link to="/$band/settings/venues" params={{ band: b.slug }} search={{ archived: true }}>
            {venues}
          </Link>
        </li>
        <li>
          <Link to="/$band/settings/contacts" params={{ band: b.slug }} search={{ archived: true }}>
            {contacts}
          </Link>
        </li>
      </ul>
    </section>
  )
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1>{m.title}</h1>
      {m.body(archive)}
    </main>
  )
}
