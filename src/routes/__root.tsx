import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import lockup from '../assets/gigg-lockup.svg'
import lockupInk from '../assets/gigg-lockup-ink.svg'
import { useEffect, useState } from 'react'
import { UserMenu } from '#/components/UserMenu'
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
  return (
    <>
      {!online && (
        <p className="offline" role="status">
          Offline: showing saved data. Changes can't be saved.
        </p>
      )}
      <header className="site-header">
        <Link to="/" aria-label="Gigg home">
          {/* CSS shows the one matching the theme (handover: no yellow wordmark on light). */}
          <img className="logo-on-light" src={lockupInk} alt="Gigg" height={32} width={97} />
          <img className="logo-on-dark" src={lockup} alt="Gigg" height={32} width={97} />
        </Link>
        {me ? <UserMenu email={me.email} bands={me.bands} isAdmin={me.isAdmin} /> : <Link to="/login">Sign in</Link>}
      </header>
      <Outlet />
    </>
  )
}
