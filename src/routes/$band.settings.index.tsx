import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'
import { KeyRound, Plus } from 'lucide-react'
import { Field } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Separator } from '#/components/ui/separator'
import { bandOp, inviteMember } from '#/server/fns'
import { currentTheme, setTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'

export const Route = createFileRoute('/$band/settings/')({
  // Readers can't list members.
  loader: async ({ params }) => ({
    members: (await bandOp('getBand', params.band, {})).role === 'member' ? await bandOp('listMembers', params.band, {}) : [],
    feed: await bandOp('calendarFeed', params.band, {}),
  }),
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
  const { members, feed } = Route.useLoaderData()
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

  const [feedStatus, setFeedStatus] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  useEffect(() => setFeedUrl(`${location.origin}/api/calendar/${feed.token}.ics`), [feed.token])
  const webcal = feedUrl.replace(/^https?:/, 'webcal:')

  async function copyFeed() {
    await navigator.clipboard.writeText(feedUrl)
    setFeedStatus('Link copied')
  }

  async function resetFeed() {
    if (!confirm('Reset your calendar link? Calendars using the old link stop updating.')) return
    await bandOp('resetCalendarFeed', band.slug, {})
    await router.invalidate()
    setFeedStatus('New link made. Add it to your calendar again.')
  }

  function pick(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  return (
    <>
      <h1>Settings</h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              You
            </CardTitle>
            <CardDescription>
              Signed in as <strong className="text-foreground">{me?.name || me?.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <form onSubmit={saveName} className="flex flex-wrap items-end gap-2">
              <Field label="Display name" className="min-w-48 flex-1">
                <Input name="name" defaultValue={me?.name} maxLength={100} placeholder={me?.email} />
              </Field>
              <Button type="submit">Save</Button>
              <span className="self-center text-sm text-muted-foreground">{nameStatus}</span>
            </form>
            <Separator />
            <div className="grid gap-3">
              <h3 className="mb-0 text-sm font-medium">Passkeys</h3>
              {passkeys.data && passkeys.data.length > 0 && (
                <ul aria-label="Your passkeys" className="divide-y rounded-lg border">
                  {passkeys.data.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <KeyRound aria-hidden className="size-4 text-muted-foreground" />
                      <span className="flex-1">
                        {p.name || (p.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey')}
                        {p.createdAt && <span className="text-muted-foreground">, added {new Date(p.createdAt).toLocaleDateString()}</span>}
                      </span>
                      <Button variant="ghost" size="xs" onClick={() => deletePasskey(p.id)}>
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <Button variant="outline" onClick={addPasskey}>
                  <Plus aria-hidden /> Add a passkey
                </Button>
              </div>
              {status && (
                <p role="status" className="text-sm text-muted-foreground">
                  {status}
                </p>
              )}
            </div>
            <Separator />
            <fieldset className="grid gap-3">
              <legend className="mb-3 text-sm font-medium">Theme</legend>
              <RadioGroup value={theme} onValueChange={(v) => pick(v as Theme)} className="flex gap-6">
                {themes.map((t) => (
                  <Label key={t.value} className="font-normal">
                    <RadioGroupItem value={t.value} /> {t.label}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Calendar
            </CardTitle>
            <CardDescription>
              Subscribe to {band.name}'s gigs (options, confirmed and played) in your own calendar. It updates by itself: Apple Calendar within minutes, Google
              within a day. This link is personal, so don't share it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input aria-label="Your calendar link" readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`} target="_blank" rel="noreferrer">
                  Add to Google Calendar
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={webcal}>Add to Apple Calendar</a>
              </Button>
              <Button variant="outline" onClick={copyFeed}>
                Copy link
              </Button>
              <Button variant="ghost" onClick={resetFeed}>
                Reset link
              </Button>
            </div>
            {feedStatus && (
              <p role="status" className="text-sm text-muted-foreground">
                {feedStatus}
              </p>
            )}
          </CardContent>
        </Card>

        {band.role === 'member' && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                {band.name}
              </CardTitle>
              <CardAction className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/$band/settings/venues" params={{ band: band.slug }}>
                    Venues
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/$band/settings/contacts" params={{ band: band.slug }}>
                    Contacts
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <h3 className="mb-0 text-sm font-medium">Members</h3>
              <ul aria-label="Members" className="divide-y rounded-lg border">
                {members.map((m) => (
                  <li key={m.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{m.name || m.email}</span>
                    <Badge variant={m.role === 'member' ? 'secondary' : 'outline'}>{m.role}</Badge>
                    {m.email !== me?.email && (
                      <Button variant="ghost" size="xs" onClick={() => removeMember(m.email)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
                <Field label="Invite by email" className="min-w-48 flex-1">
                  <Input name="email" type="email" required maxLength={200} />
                </Field>
                <Field label="Role">
                  <NativeSelect name="role">
                    <NativeSelectOption value="member">Member (can edit)</NativeSelectOption>
                    <NativeSelectOption value="reader">Reader (view only)</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Button type="submit">Invite</Button>
              </form>
              {inviteStatus && (
                <p role="status" className="text-sm text-muted-foreground">
                  {inviteStatus}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
