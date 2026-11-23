import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { onboardingItems, showInstallItem } from '#/lib/onboarding'
import { useT } from '#/lib/i18n'

const bandRoute = getRouteApi('/$band')

/** This person's "Get to know gigg" items. The install item depends on the device, so it's added after hydration. */
export function useOnboarding() {
  const band = bandRoute.useLoaderData()
  const install = useSyncExternalStore(() => () => {}, showInstallItem, () => false)
  const items = onboardingItems(band.onboarding, install)
  return { band, items, done: items.filter((i) => i.done).length, hidden: band.onboarding.hidden }
}

/** A slim link on the events page until it's hidden (Hide, or the "All set" end). */
export function OnboardingBar() {
  const { band, items, done, hidden } = useOnboarding()
  const t = useT()
  if (hidden) return null
  return (
    <Link
      to="/$band/welcome"
      params={{ band: band.slug }}
      className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
    >
      <span className="flex-1">{done === items.length ? t.welcome.barDone : t.welcome.bar(done, items.length)}</span>
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  )
}
