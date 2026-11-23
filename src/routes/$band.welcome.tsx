import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import { useOnboarding } from '#/components/Onboarding'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import type { BandItem, PersonalItem } from '#/lib/onboarding'
import { useOnline } from '#/lib/online'

export const Route = createFileRoute('/$band/welcome')({ component: Welcome })

type To = '/$band/events/new' | '/$band/songs' | '/$band/events' | '/$band/settings'
const links: Record<BandItem | PersonalItem, To | null> = {
  event: '/$band/events/new',
  songs: '/$band/songs',
  setlist: '/$band/events',
  invite: '/$band/settings',
  availability: '/$band/events',
  passkey: '/$band/settings',
  calendar: '/$band/settings',
  notifications: '/$band/settings',
  install: null,
}

/** "Get to know gigg": band items tick from the band's data, personal ones when you tap them. Nothing is required. */
function Welcome() {
  const { band, items, done, hidden } = useOnboarding()
  const online = useOnline()
  const router = useRouter()
  const t = useT()
  const allDone = done === items.length
  // The first time everything is ticked: say so, and hide the bar from then on.
  const [allSet, setAllSet] = useState(false)
  useEffect(() => {
    if (!allDone || hidden || !online) return
    setAllSet(true)
    bandOp('hideOnboarding', band.slug, {}).then(() => router.invalidate(), () => {})
  }, [allDone, hidden, online, band.slug, router])

  const tick = (key: PersonalItem) => bandOp('tickOnboarding', band.slug, { key }).then(() => router.invalidate(), () => {})
  const hide = () => bandOp('hideOnboarding', band.slug, {}).then(() => router.invalidate(), () => {})

  const section = (title: string, personal: boolean) => {
    const list = items.filter((i) => i.personal === personal)
    if (!list.length) return null
    return (
      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">{title}</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {list.map(({ key, done }) => {
            const item = t.welcome.items[key]
            const to = links[key]
            return (
              <li key={key} data-done={done || undefined} className="flex gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${done ? 'border-transparent bg-stage text-ink' : ''}`}
                >
                  {done && <Check className="size-3.5" />}
                </span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <h3 className={`mb-0 text-sm font-medium ${done ? 'text-muted-foreground line-through' : ''}`}>
                    {item.title}
                    {done && <span className="sr-only"> ({t.welcome.done})</span>}
                  </h3>
                  <p className="mb-0 text-sm text-muted-foreground">{item.text}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {to && (
                      <Link
                        to={to}
                        params={{ band: band.slug }}
                        className="underline"
                        onClick={() => personal && !done && online && tick(key as PersonalItem)}
                      >
                        {item.link}
                      </Link>
                    )}
                    {personal && !done && online && (
                      <button type="button" className="underline" onClick={() => tick(key as PersonalItem)}>
                        {t.welcome.gotIt}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{t.welcome.title}</h1>
        {!hidden && online && (
          <Button variant="ghost" size="sm" onClick={hide}>
            {t.welcome.hide}
          </Button>
        )}
      </div>
      <p className="mb-6 text-muted-foreground">{t.welcome.intro}</p>
      {allSet && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border bg-stage/20 px-4 py-3 font-medium">
          <PartyPopper aria-hidden className="size-5" /> {t.welcome.allSet}
        </p>
      )}
      {section(t.welcome.bandTitle, false)}
      {section(t.welcome.youTitle, true)}
    </>
  )
}
