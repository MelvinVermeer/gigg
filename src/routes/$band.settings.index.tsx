import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'
import { currentTheme, setTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'

export const Route = createFileRoute('/$band/settings/')({ component: Settings })

const rootRoute = getRouteApi('__root__')
const bandRoute = getRouteApi('/$band')
const themes: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function Settings() {
  const me = rootRoute.useLoaderData()
  const band = bandRoute.useLoaderData()
  const [theme, setThemeState] = useState<Theme>('system')
  const [status, setStatus] = useState('')
  const passkeys = authClient.useListPasskeys()
  useEffect(() => setThemeState(currentTheme()), [])

  async function addPasskey() {
    const res = await authClient.passkey.addPasskey({ name: deviceName(navigator.userAgent) })
    setStatus(res?.error ? (res.error.message ?? 'Could not add passkey') : 'Passkey added')
  }

  async function deletePasskey(id: string) {
    if (!confirm('Delete this passkey? You can no longer sign in with it.')) return
    const res = await authClient.passkey.deletePasskey({ id })
    setStatus(res.error ? (res.error.message ?? 'Could not delete passkey') : 'Passkey deleted')
    passkeys.refetch()
  }

  function pick(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  return (
    <>
      <h1>Settings</h1>

      <section>
        <h2>You</h2>
        <p>
          Signed in as <strong>{me?.email}</strong>
        </p>
        {passkeys.data && passkeys.data.length > 0 && (
          <ul aria-label="Your passkeys">
            {passkeys.data.map((p) => (
              <li key={p.id}>
                {p.name || (p.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey')}
                {p.createdAt && <>, added {new Date(p.createdAt).toLocaleDateString()}</>}{' '}
                <button type="button" onClick={() => deletePasskey(p.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <p>
          <button type="button" onClick={addPasskey}>
            Add a passkey
          </button>
        </p>
        {status && <p role="status">{status}</p>}
        <fieldset className="theme">
          <legend>Theme</legend>
          {themes.map((t) => (
            <label key={t.value}>
              <input type="radio" name="theme" checked={theme === t.value} onChange={() => pick(t.value)} /> {t.label}
            </label>
          ))}
        </fieldset>
      </section>

      {band.role === 'member' && (
        <section>
          <h2>{band.name}</h2>
          <p>
            <Link to="/$band/settings/venues" params={{ band: band.slug }}>
              Venues
            </Link>{' '}
            ·{' '}
            <Link to="/$band/settings/contacts" params={{ band: band.slug }}>
              Contacts
            </Link>
          </p>
        </section>
      )}
    </>
  )
}
