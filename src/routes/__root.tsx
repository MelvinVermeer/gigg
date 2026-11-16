import { HeadContent, Link, Outlet, Scripts, createRootRoute, useParams } from '@tanstack/react-router'

import lockup from '../assets/gigg-lockup.svg'
import lockupInk from '../assets/gigg-lockup-ink.svg'
import { useEffect } from 'react'
import { InstallBanner } from '#/components/InstallApp'
import { HeaderSearch } from '#/components/HeaderSearch'
import { PasskeyPrompt } from '#/components/PasskeyPrompt'
import { UserMenu } from '#/components/UserMenu'
import { Button } from '#/components/ui/button'
import { useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'
import { themeScript } from '#/lib/theme'
import { getMe } from '#/server/fns'
import appCss from '../styles.css?url'
import { ConfirmHost } from '#/components/ConfirmDialog'

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
  // The language and signed-in user, for every page. Loaded once; sign-in, sign-out and a language change do a full page load.
  loader: () => getMe(),
  staleTime: Infinity,
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale } = Route.useLoaderData()
  return (
    // data-theme is set by themeScript before hydration, hence suppressHydrationWarning.
    <html lang={locale} suppressHydrationWarning>
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

function RootLayout() {
  const me = Route.useLoaderData().user
  const t = useT()
  const online = useOnline()
  // The offline service worker (production only).
  useEffect(() => {
    if (import.meta.env.PROD) navigator.serviceWorker?.register('/sw.js')
  }, [])
  // Search is per band: the band you're in, otherwise your first band.
  const searchBand = useParams({ strict: false }).band ?? me?.bands[0]?.slug
  return (
    <>
      {!online && (
        <p className="bg-stage px-4 py-1.5 text-center text-sm font-medium text-ink" role="status">
          {t.header.offline}
        </p>
      )}
      <header className="site-header sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-4 px-4">
        <Link to="/" aria-label={t.header.home} className="shrink-0">
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
              <Link to="/login">{t.header.signIn}</Link>
            </Button>
          )}
        </div>
        </div>
      </header>
      {me && <InstallBanner />}
      {me && <PasskeyPrompt />}
      <ConfirmHost />
      <Outlet />
    </>
  )
}
