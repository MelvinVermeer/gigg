import { Link, useParams } from '@tanstack/react-router'
import { useRef } from 'react'
import { authClient } from '#/lib/auth-client'

type Props = { email: string; bands: { slug: string; name: string }[] }

/** Avatar button + menu. Native popover: closes on outside click and Escape, no library. */
export function UserMenu({ email, bands }: Props) {
  const menu = useRef<HTMLDivElement>(null)
  const close = () => menu.current?.hidePopover()
  // Settings live per band: the band you're in, otherwise your first band.
  const settingsBand = useParams({ strict: false }).band ?? bands[0]?.slug

  async function logOut() {
    close()
    await authClient.signOut()
    // The offline cache holds band data too (public/sw.js).
    for (const key of (await globalThis.caches?.keys()) ?? []) await caches.delete(key)
    // Full page load: drops all band data the browser still holds in memory.
    window.location.assign('/')
  }

  return (
    <>
      <button type="button" className="avatar" popoverTarget="user-menu" aria-label={`Account menu for ${email}`}>
        {email[0].toUpperCase()}
      </button>
      <div id="user-menu" ref={menu} popover="auto" className="user-menu">
        <p className="email">{email}</p>
        <nav aria-label="Account">
          {bands.map((b) => (
            <Link key={b.slug} to="/$band" params={{ band: b.slug }} onClick={close}>
              {b.name}
            </Link>
          ))}
          {settingsBand && (
            <Link to="/$band/settings" params={{ band: settingsBand }} onClick={close}>
              Settings
            </Link>
          )}
          <button type="button" onClick={logOut}>
            Log out
          </button>
        </nav>
      </div>
    </>
  )
}
