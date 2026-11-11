import { HeadContent, Link, Outlet, Scripts, createRootRoute, useParams } from '@tanstack/react-router'

import lockup from '../assets/gigg-lockup.svg'
import lockupInk from '../assets/gigg-lockup-ink.svg'
import { useEffect, useState } from 'react'
import { HeaderSearch } from '#/components/HeaderSearch'
import { PasskeyPrompt } from '#/components/PasskeyPrompt'
import { UserMenu } from '#/components/UserMenu'
import { Button } from '#/components/ui/button'
import { themeScript } from '#/lib/theme'
import { getMe } from '#/server/fns'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#111111' },
      { title: 'Gigg' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  // The signed-in user, for the header. Loaded once; sign-in and sign-out do a full page load.
  loader: () => getMe(),
  staleTime: Infinity,
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by themeScript before hydration, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

/** Registers the offline service worker (production only) and tracks whether we're online. */
function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    if (import.meta.env.PROD) navigator.serviceWorker?.register('/sw.js')
    const update = () => setOnline(navigator.onLine)
    update()
    addEventListener('online', update)
    addEventListener('offline', update)
    return () => {
      removeEventListener('online', update)
      removeEventListener('offline', update)
    }
  }, [])
  return online
}

function RootLayout() {
  const me = Route.useLoaderData()
  const online = useOnline()
  // Search is per band: the band you're in, otherwise your first band.
  const searchBand = useParams({ strict: false }).band ?? me?.bands[0]?.slug
  return (
    <>
      {!online && (
        <p className="bg-stage px-4 py-1.5 text-center text-sm font-medium text-ink" role="status">
          Offline: showing saved data. Changes can't be saved.
        </p>
      )}
      <header className="site-header sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-4 px-4">
        <Link to="/" aria-label="Gigg home" className="shrink-0">
          {/* CSS shows the one matching the theme (handover: no yellow wordmark on light). */}
          <img className="logo-on-light" src={lockupInk} alt="Gigg" height={32} width={97} />
          <img className="logo-on-dark" src={lockup} alt="Gigg" height={32} width={97} />
        </Link>
        {searchBand && <HeaderSearch band={searchBand} />}
        <div className="ml-auto">
          {me ? (
            <UserMenu name={me.name || me.email} bands={me.bands} isAdmin={me.isAdmin} />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
        </div>
      </header>
      {me && <PasskeyPrompt />}
      <Outlet />
    </>
  )
}
