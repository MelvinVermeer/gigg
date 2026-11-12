import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'
import { Check, KeyRound, Plus } from 'lucide-react'
import { Field } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Separator } from '#/components/ui/separator'
import { bandOp, inviteMember, setLocale } from '#/server/fns'
import { currentTheme, setTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'
import { dicts, errorText, locales, useT } from '#/lib/i18n'

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
const themes: Theme[] = ['system', 'light', 'dark']

function Settings() {
  const { members, feed } = Route.useLoaderData()
  const router = useRouter()
  const { user: me, locale } = rootRoute.useLoaderData()
  const t = useT()
  const band = bandRoute.useLoaderData()
  const [theme, setThemeState] = useState<Theme>('system')
  const [status, setStatus] = useState('')
  const passkeys = authClient.useListPasskeys()
  useEffect(() => setThemeState(currentTheme()), [])

  async function addPasskey() {
    const res = await authClient.passkey.addPasskey({ name: deviceName(navigator.userAgent, t.passkey.deviceOn) })
    setStatus(res?.error ? (res.error.message ?? t.passkey.couldNotAdd) : t.settings.passkeyAdded)
  }

  async function deletePasskey(id: string) {
    if (!confirm(t.settings.deletePasskeyConfirm)) return
    const res = await authClient.passkey.deletePasskey({ id })
    setStatus(res.error ? (res.error.message ?? t.settings.couldNotDelete) : t.settings.passkeyDeleted)
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
      setInviteStatus(t.settings.invited(String(data.get('email'))))
      await router.invalidate()
    } catch (err) {
      setInviteStatus(errorText(t, err, t.settings.couldNotInvite))
    }
  }

  async function removeMember(email: string) {
    if (!confirm(t.settings.removeConfirm(email, band.name))) return
    await bandOp('removeMember', band.slug, { email })
    await router.invalidate()
  }

  // '' | 'saved' | an error message
  const [nameStatus, setNameStatus] = useState('')

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const res = await authClient.updateUser({ name: String(new FormData(e.currentTarget).get('name')).trim() })
    setNameStatus(res.error ? (res.error.message ?? t.settings.couldNotSave) : 'saved')
    await router.invalidate()
  }

  const [feedStatus, setFeedStatus] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  useEffect(() => setFeedUrl(`${location.origin}/api/calendar/${feed.token}.ics`), [feed.token])
  const webcal = feedUrl.replace(/^https?:/, 'webcal:')

  async function copyFeed() {
    await navigator.clipboard.writeText(feedUrl)
    setFeedStatus(t.settings.linkCopied)
  }

  async function resetFeed() {
    if (!confirm(t.settings.resetConfirm)) return
    await bandOp('resetCalendarFeed', band.slug, {})
    await router.invalidate()
    setFeedStatus(t.settings.newLink)
  }

  function pick(next: Theme) {
    setTheme(next)
    setThemeState(next)
  }

  async function pickLanguage(next: string) {
    await setLocale({ data: { locale: next } })
    // Everything on the page, and the cached header, renders in the new language.
    window.location.reload()
  }

  return (
    <>
      <h1>{t.settings.title}</h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {t.settings.you}
            </CardTitle>
            <CardDescription>
              {t.settings.signedInAs} <strong className="text-foreground">{me?.name || me?.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <form onSubmit={saveName} className="flex flex-wrap items-end gap-2">
              <Field label={t.settings.displayName} className="min-w-48 flex-1">
                <Input name="name" defaultValue={me?.name} maxLength={100} placeholder={me?.email} onChange={() => setNameStatus('')} />
              </Field>
              <Button type="submit" aria-live="polite">
                {nameStatus === 'saved' ? (
                  <>
                    <Check aria-hidden /> {t.common.saved}
                  </>
                ) : (
                  t.common.save
                )}
              </Button>
              {nameStatus !== 'saved' && <span className="self-center text-sm text-destructive">{nameStatus}</span>}
            </form>
            <Separator />
            <div className="grid gap-3">
              <h3 className="mb-0 text-sm font-medium">{t.settings.passkeys}</h3>
              {passkeys.data && passkeys.data.length > 0 && (
                <ul aria-label={t.settings.yourPasskeys} className="divide-y rounded-lg border">
                  {passkeys.data.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <KeyRound aria-hidden className="size-4 text-muted-foreground" />
                      <span className="flex-1">
                        {p.name || (p.deviceType === 'multiDevice' ? t.settings.synced : t.settings.device)}
                        {p.createdAt && <span className="text-muted-foreground">{t.settings.added(new Date(p.createdAt).toLocaleDateString(t.intl))}</span>}
                      </span>
                      <Button variant="ghost" size="xs" onClick={() => deletePasskey(p.id)}>
                        {t.common.delete}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <Button variant="outline" onClick={addPasskey}>
                  <Plus aria-hidden /> {t.settings.addPasskey}
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
              <legend className="mb-3 text-sm font-medium">{t.settings.theme}</legend>
              <RadioGroup value={theme} onValueChange={(v) => pick(v as Theme)} className="flex gap-6">
                {themes.map((value) => (
                  <Label key={value} className="font-normal">
                    <RadioGroupItem value={value} /> {t.settings.themes[value]}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            <Separator />
            <fieldset className="grid gap-3">
              <legend className="mb-3 text-sm font-medium">{t.settings.language}</legend>
              <RadioGroup value={locale} onValueChange={pickLanguage} className="flex gap-6">
                {/* Each language in its own name, so you can find yours whatever the page is in. */}
                {locales.map((l) => (
                  <Label key={l} lang={l} className="font-normal">
                    <RadioGroupItem value={l} /> {dicts[l].languageName}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {t.settings.calendar}
            </CardTitle>
            <CardDescription>{t.settings.calendarIntro(band.name)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input aria-label={t.settings.calendarLink} readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a
                  href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => navigator.clipboard.writeText(feedUrl).then(() => setFeedStatus(t.settings.googleCopied))}
                >
                  {t.settings.addGoogle}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={webcal}>{t.settings.addApple}</a>
              </Button>
              <Button variant="outline" onClick={copyFeed}>
                {t.settings.copyLink}
              </Button>
              <Button variant="ghost" onClick={resetFeed}>
                {t.settings.resetLink}
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
                    {t.common.venues}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/$band/settings/contacts" params={{ band: band.slug }}>
                    {t.common.contacts}
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <h3 className="mb-0 text-sm font-medium">{t.settings.members}</h3>
              <ul aria-label={t.settings.members} className="divide-y rounded-lg border">
                {members.map((m) => (
                  <li key={m.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{m.name || m.email}</span>
                    <Badge variant={m.role === 'member' ? 'secondary' : 'outline'}>{t.role[m.role]}</Badge>
                    {m.email !== me?.email && (
                      <Button variant="ghost" size="xs" onClick={() => removeMember(m.email)}>
                        {t.common.remove}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
                <Field label={t.settings.inviteByEmail} className="min-w-48 flex-1">
                  <Input name="email" type="email" required maxLength={200} />
                </Field>
                <Field label={t.settings.role}>
                  <NativeSelect name="role">
                    <NativeSelectOption value="member">{t.settings.roleMember}</NativeSelectOption>
                    <NativeSelectOption value="reader">{t.settings.roleReader}</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Button type="submit">{t.settings.invite}</Button>
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
