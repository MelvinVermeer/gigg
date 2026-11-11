import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'
import { bandOp, inviteMember } from '#/server/fns'
import { currentTheme, setTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'

export const Route = createFileRoute('/$band/settings/')({
  // Readers can't list members.
  loader: async ({ params }) => ({ members: (await bandOp('getBand', params.band, {})).role === 'member' ? await bandOp('listMembers', params.band, {}) : [] }),
  component: Settings,
})

const rootRoute = getRouteApi('__root__')
const bandRoute = getRouteApi('/$band')
const themes: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function Settings() {
  const { members } = Route.useLoaderData()
  const router = useRouter()
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

  const [inviteStatus, setInviteStatus] = useState('')

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setInviteStatus('')
    try {
      await inviteMember({ data: { band: band.slug, email: String(data.get('email')), role: String(data.get('role')) } })
      form.reset()
      setInviteStatus(`Invited ${data.get('email')}`)
      await router.invalidate()
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : 'Could not invite')
    }
  }

  async function removeMember(email: string) {
    if (!confirm(`Remove ${email} from ${band.name}?`)) return
    await bandOp('removeMember', band.slug, { email })
    await router.invalidate()
  }

  const [nameStatus, setNameStatus] = useState('')

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const res = await authClient.updateUser({ name: String(new FormData(e.currentTarget).get('name')).trim() })
    setNameStatus(res.error ? (res.error.message ?? 'Could not save') : 'Saved')
    await router.invalidate()
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
          Signed in as <strong>{me?.name || me?.email}</strong>
        </p>
        <form onSubmit={saveName}>
          <label>
            Display name <input name="name" defaultValue={me?.name} maxLength={100} placeholder={me?.email} />
          </label>{' '}
          <button type="submit">Save</button> <span role="status">{nameStatus}</span>
        </form>
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
          <h3>Members</h3>
          <ul aria-label="Members">
            {members.map((m) => (
              <li key={m.email}>
                {m.name || m.email} ({m.role}){' '}
                {m.email !== me?.email && (
                  <button type="button" onClick={() => removeMember(m.email)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={invite}>
            <label>
              Invite by email <input name="email" type="email" required maxLength={200} />
            </label>{' '}
            <label>
              Role{' '}
              <select name="role">
                <option value="member">Member (can edit)</option>
                <option value="reader">Reader (view only)</option>
              </select>
            </label>{' '}
            <button type="submit">Invite</button>
          </form>
          {inviteStatus && <p role="status">{inviteStatus}</p>}
        </section>
      )}
    </>
  )
}
