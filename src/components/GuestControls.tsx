import { getRouteApi } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { dicts, locales, setGuestLocale, useT } from '#/lib/i18n'
import { setTheme } from '#/lib/theme'

const rootRoute = getRouteApi('__root__')

/** Signed-out header: language and light/dark. Signed in, both live in Settings. */
export function GuestControls() {
  const t = useT()
  const { locale } = rootRoute.useLoaderData()

  // Flip what's on screen now: a picked theme, else the system's.
  function toggleTheme() {
    const picked = document.documentElement.dataset.theme
    const dark = picked ? picked === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(dark ? 'light' : 'dark')
  }

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={t.header.language} className="flex rounded-full border p-0.5">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-label={dicts[l].languageName}
            aria-pressed={l === locale}
            onClick={() => l !== locale && setGuestLocale(l)}
            className="rounded-full px-2 py-1 text-xs font-bold tracking-wider text-muted-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label={t.header.theme}
        onClick={toggleTheme}
        className="grid size-8 place-items-center rounded-full border text-foreground"
      >
        {/* The icon shows the current theme, like the wordmark (styles.css). */}
        <Moon className="logo-on-dark size-4" aria-hidden />
        <Sun className="logo-on-light size-4" aria-hidden />
      </button>
    </div>
  )
}
