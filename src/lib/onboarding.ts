// "Get to know gigg": band items tick from the band's data (getBand), personal items when tapped.
export const bandItems = ['event', 'songs', 'setlist', 'invite', 'availability'] as const
export const personalItems = ['passkey', 'calendar', 'notifications', 'install'] as const
export type BandItem = (typeof bandItems)[number]
export type PersonalItem = (typeof personalItems)[number]
export type Onboarding = { hidden: boolean; band: Record<BandItem, boolean> | null; seen: string[] }

/** iPhone/iPad Safari not opened as the app: no install prompt there, so it gets an item. Client-side only. */
export const showInstallItem = () =>
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  !matchMedia('(display-mode: standalone)').matches

/** The items this person sees, each with whether it's done. Readers get only personal items. */
export function onboardingItems(o: Onboarding, install = showInstallItem()) {
  const band = o.band ? bandItems.map((key) => ({ key, done: o.band![key], personal: false })) : []
  const personal = personalItems
    .filter((k) => k !== 'install' || install)
    .map((key) => ({ key, done: o.seen.includes(key), personal: true }))
  return [...band, ...personal]
}
