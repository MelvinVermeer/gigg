import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Locale } from '#/lib/i18n'

export const Route = createFileRoute('/privacy')({ component: Privacy })

// Static, like the manual. Update both languages together.
const rootRoute = getRouteApi('__root__')

const P = ({ children }: { children: ReactNode }) => <p className="leading-7 text-muted-foreground">{children}</p>
const H = ({ children }: { children: ReactNode }) => <h2 className="mt-8">{children}</h2>

const text: Record<Locale, { title: string; body: ReactNode }> = {
  en: {
    title: 'Privacy',
    body: (
      <>
        <H>What we store</H>
        <P>
          Your email address, the name you give yourself, your language and your notification choices. Everything your band puts in: songs, events,
          setlists, venues, contacts, availability answers and the files you upload. Every change is kept in the band's history, with who made it.
          Passkeys are stored as public keys only; we never see your fingerprint or face.
        </P>
        <H>Where</H>
        <P>
          The app runs on Vercel and the data is stored with Neon, both in Frankfurt (EU). Sign-in emails go out through an email provider. Your band's
          data is only visible to its members and readers, and to whoever you send a shared link.
        </P>
        <H>No tracking</H>
        <P>
          No analytics, no ads, no tracking cookies. Cookies are only used to keep you signed in and to remember which band you last opened. Push
          notifications only reach the devices where you switched them on.
        </P>
        <H>Getting it deleted</H>
        <P>Ask through Feedback in the account menu and we'll delete your account, or your band with everything in it.</P>
      </>
    ),
  },
  nl: {
    title: 'Privacy',
    body: (
      <>
        <H>Wat we bewaren</H>
        <P>
          Je e-mailadres, de naam die je jezelf geeft, je taal en je keuzes voor meldingen. Alles wat je band invoert: nummers, optredens, setlists,
          locaties, contacten, antwoorden over beschikbaarheid en de bestanden die je uploadt. Elke wijziging blijft bewaard in de geschiedenis van de
          band, met wie hem deed. Van passkeys bewaren we alleen een publieke sleutel; je vingerafdruk of gezicht zien we nooit.
        </P>
        <H>Waar</H>
        <P>
          De app draait bij Vercel en de gegevens staan bij Neon, allebei in Frankfurt (EU). Inlogmails gaan via een e-mailprovider. De gegevens van je
          band zijn alleen zichtbaar voor de leden en lezers, en voor wie je een gedeelde link stuurt.
        </P>
        <H>Geen tracking</H>
        <P>
          Geen analytics, geen advertenties, geen trackingcookies. Cookies gebruiken we alleen om je ingelogd te houden en om te onthouden welke band je
          het laatst opende. Pushmeldingen komen alleen op de apparaten waar je ze hebt aangezet.
        </P>
        <H>Laten verwijderen</H>
        <P>Vraag het via Feedback in het accountmenu en we verwijderen je account, of je band met alles erin.</P>
      </>
    ),
  },
}

function Privacy() {
  const page = text[rootRoute.useLoaderData().locale]
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1>{page.title}</h1>
      {page.body}
    </main>
  )
}
