import { Link, useParams } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { authClient } from '#/lib/auth-client'

type Props = { name: string; bands: { slug: string; name: string }[]; isAdmin: boolean }

/** Avatar button + menu. Native popover: closes on outside click and Escape, no library. */
export function UserMenu({ name, bands, isAdmin }: Props) {
  const menu = useRef<HTMLDivElement>(null)
  const close = () => menu.current?.hidePopover()
  // Settings live per band: the band you're in, otherwise your first band.
  const settingsBand = useParams({ strict: false }).band ?? bands[0]?.slug
  const current = bands.find((b) => b.slug === settingsBand) ?? bands[0]
  const others = bands.filter((b) => b !== current)
  const [switching, setSwitching] = useState(false)

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
      <button type="button" className="avatar" popoverTarget="user-menu" aria-label={`Account menu for ${name}`}>
        {name[0].toUpperCase()}
      </button>
      <div id="user-menu" ref={menu} popover="auto" className="user-menu">
        <p className="email">{name}</p>
        <nav aria-label="Account">
          {current && (
            <span className="current-band">
              <Link to="/$band" params={{ band: current.slug }} onClick={close}>
                {current.name}
              </Link>
              {others.length > 0 && (
                <button
                  type="button"
                  aria-label="Switch band"
                  aria-expanded={switching}
                  onClick={() => setSwitching(!switching)}
                >
                  ⇄
                </button>
              )}
            </span>
          )}
          {switching &&
            others.map((b) => (
              <Link key={b.slug} to="/$band" params={{ band: b.slug }} onClick={close}>
                {b.name}
              </Link>
            ))}
          {settingsBand && (
            <Link to="/$band/settings" params={{ band: settingsBand }} onClick={close}>
              Settings
            </Link>
          )}
          {settingsBand && (
            <Link to="/$band/feedback" params={{ band: settingsBand }} onClick={close}>
              Feedback
            </Link>
          )}
          <Link to="/manual" onClick={close}>
            Manual
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={close}>
              Admin
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
