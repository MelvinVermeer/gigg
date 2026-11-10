import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'

import lockup from '../assets/gigg-lockup.svg'
import lockupInk from '../assets/gigg-lockup-ink.svg'
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
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="site-header">
          <Link to="/" aria-label="Gigg home">
            {/* Yellow wordmark on dark, ink wordmark on light (handover rule). */}
            <picture>
              <source srcSet={lockup} media="(prefers-color-scheme: dark)" />
              <img src={lockupInk} alt="Gigg" height={32} width={97} />
            </picture>
          </Link>
        </header>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
