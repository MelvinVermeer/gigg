// Two languages, no library: `en` is the source; `nl` must have every key (the type checks it).
// Values are strings, or functions for anything with variables or plurals.
import { getRouteApi } from '@tanstack/react-router'
import { createContext, useContext } from 'react'
import { en } from './i18n.en'
import { nl } from './i18n.nl'

export type Dict = typeof en
export type Locale = 'en' | 'nl'
export const locales: Locale[] = ['en', 'nl']
export const dicts: Record<Locale, Dict> = { en, nl }

export const isLocale = (v: unknown): v is Locale => locales.includes(v as Locale)
/** A stored language, English if it's anything else. */
export const localeOf = (v: unknown): Locale => (isLocale(v) ? v : 'en')

/** First supported language in an Accept-Language header ("nl-NL,nl;q=0.9,en;q=0.8" → nl); English otherwise. */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  const tags = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  return tags.find((t) => isLocale(t.lang))?.lang as Locale | undefined ?? 'en'
}

/** Signed out: remember the language picked in the header (a cookie the server reads), then reload into it. */
export function setGuestLocale(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`
  window.location.reload()
}

/** For pages that speak someone else's language (an emailed availability link speaks the recipient's). */
export const LocaleOverride = createContext<Locale | null>(null)

const rootRoute = getRouteApi('__root__')

/** The dictionary for this page: the signed-in user's language, or the browser's when signed out. */
export function useT(): Dict {
  const override = useContext(LocaleOverride)
  const root = rootRoute.useLoaderData()
  return dicts[override ?? root.locale]
}

/** One entry of a label map by a runtime key (an enum value, a column name); the key itself if unknown. */
export const label = (map: object, key: string): string => (map as Record<string, string>)[key] ?? key

/** An error for the user: server errors thrown by key (see `errors`) are translated, others shown as they are. */
export function errorText(t: Dict, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : ''
  return message ? label(t.errors, message) : fallback
}
