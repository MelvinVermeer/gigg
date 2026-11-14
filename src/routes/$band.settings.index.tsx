import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'
import { Check, KeyRound, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { Field } from '#/components/Field'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Separator } from '#/components/ui/separator'
import { bandOp, inviteMember, setLocale } from '#/server/fns'
import { currentTheme, setTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'
import { dicts, errorText, locales, useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'
import { confirmDialog } from '#/components/ConfirmDialog'

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
const themes = [
  ['light', Sun],
  ['dark', Moon],
  ['system', Monitor],
] as const

function Settings() {
  const { members, feed } = Route.useLoaderData()
  const router = useRouter()
  const { user: me, locale } = rootRoute.useLoaderData()
  const t = useT()
  const band = bandRoute.useLoaderData()
  // Offline nothing can be saved, so everything that writes hides; the theme is local and stays.
  const online = useOnline()
  const [theme, setThemeState] = useState<Theme>('system')
  const [status, setStatus] = useState('')
  const passkeys = authClient.useListPasskeys()
  useEffect(() => setThemeState(currentTheme()), [])

  async function addPasskey() {
    const res = await authClient.passkey.addPasskey({ name: deviceName(navigator.userAgent, t.passkey.deviceOn) })
    setStatus(res?.error ? (res.error.message ?? t.passkey.couldNotAdd) : t.settings.passkeyAdded)
  }

  async function deletePasskey(id: string) {
    if (!(await confirmDialog(t.settings.deletePasskeyConfirm, t.common.delete))) return
    const res = await authClient.passkey.deletePasskey({ id })
    setStatus(res.error ? (res.error.message ?? t.settings.couldNotDelete) : t.settings.passkeyDeleted)
    passkeys.refetch()
  }

  // '' | 'sent' | an error message
  const [inviteStatus, setInviteStatus] = useState('')

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setInviteStatus('')
    try {
      await inviteMember({ data: { band: band.slug, email: String(data.get('email')), role: String(data.get('role')) } })
      form.reset()
      setInviteStatus('sent')
      await router.invalidate()
    } catch (err) {
      setInviteStatus(errorText(t, err, t.settings.couldNotInvite))
    }
  }

  async function removeMember(email: string) {
    if (!(await confirmDialog(t.settings.removeConfirm(email, band.name), t.common.remove))) return
    await bandOp('removeMember', band.slug, { email })
    await router.invalidate()
  }

  // '' | 'saved' | an error message
  const [nameStatus, setNameStatus] = useState('')

  // Auto-saves on blur and Enter, only when the value changed. Empty clears the name.
  const savedName = useRef(me?.name ?? '')
  async function saveName(value: string) {
    const name = value.trim()
    if (name === savedName.current) return
    const res = await authClient.updateUser({ name })
    if (res.error) return setNameStatus(res.error.message ?? t.settings.couldNotSave)
    savedName.current = name
    setNameStatus('saved')
    setTimeout(() => setNameStatus((s) => (s === 'saved' ? '' : s)), 2000)
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
    if (!(await confirmDialog(t.settings.resetConfirm, t.settings.resetLink))) return
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
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {t.settings.you}
            </CardTitle>
            <CardDescription>
              {t.settings.signedInAs} <strong className="text-foreground">{me?.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {online && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveName(String(new FormData(e.currentTarget).get('name')))
              }}
            >
              <Field label={t.settings.displayName}>
                <Input
                  name="name"
                  defaultValue={me?.name}
                  maxLength={100}
                  placeholder={me?.email}
                  onChange={() => setNameStatus('')}
                  onBlur={(e) => saveName(e.currentTarget.value)}
                />
              </Field>
              <p aria-live="polite" className={`mt-1 min-h-5 text-sm ${nameStatus === 'saved' ? 'text-muted-foreground' : 'text-destructive'}`}>
                {nameStatus === 'saved' ? (
                  <>
                    <Check aria-hidden className="inline size-4" /> {t.common.saved}
                  </>
                ) : (
                  nameStatus
                )}
              </p>
            </form>
            )}
            {online && <Separator />}
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
                      {online && (
                        <Button variant="ghost" size="icon-sm" aria-label={t.settings.deletePasskey} onClick={() => deletePasskey(p.id)}>
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div hidden={!online}>
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
              {/* A segmented control: still a radio group for keyboard and screen readers. */}
              <RadioGroup.Root
                value={theme}
                onValueChange={(v) => pick(v as Theme)}
                aria-label={t.settings.theme}
                className="inline-flex w-fit rounded-lg bg-muted p-1"
              >
                {themes.map(([value, Icon]) => (
                  <RadioGroup.Item
                    key={value}
                    value={value}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm"
                  >
                    <Icon aria-hidden className="size-4" /> {t.settings.themes[value]}
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </fieldset>
            {online && (
              <>
                <Separator />
                <Field label={t.settings.language}>
                  <NativeSelect value={locale} onChange={(e) => pickLanguage(e.target.value)}>
                    {/* Each language in its own name, so you can find yours whatever the page is in. */}
                    {locales.map((l) => (
                      <NativeSelectOption key={l} value={l} lang={l}>
                        {dicts[l].flag} {dicts[l].languageName}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </>
            )}
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
              {online && (
                <Button variant="ghost" onClick={resetFeed}>
                  {t.settings.resetLink}
                </Button>
              )}
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
            <CardContent className="grid grid-cols-1 gap-4">
              <h3 className="mb-0 text-sm font-medium">{t.settings.members}</h3>
              <ul aria-label={t.settings.members} className="divide-y rounded-lg border">
                {members.map((m) => (
                  <li key={m.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{m.name || m.email}</span>
                    <Badge variant={m.role === 'member' ? 'secondary' : 'outline'}>{t.role[m.role]}</Badge>
                    {online && m.email !== me?.email && (
                      <Button variant="ghost" size="icon-sm" aria-label={t.settings.removeMember(m.name || m.email)} onClick={() => removeMember(m.email)}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {online && (
              <form onSubmit={invite} onChange={() => setInviteStatus('')} className="flex flex-wrap items-end gap-2">
                <Field label={t.settings.inviteByEmail} className="min-w-48 flex-1">
                  <Input name="email" type="email" required maxLength={200} />
                </Field>
                <Field label={t.settings.role}>
                  <NativeSelect name="role">
                    <NativeSelectOption value="member">{t.settings.roleMember}</NativeSelectOption>
                    <NativeSelectOption value="reader">{t.settings.roleReader}</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Button type="submit" aria-live="polite">
                  {inviteStatus === 'sent' ? (
                    <>
                      <Check aria-hidden /> {t.settings.invited}
                    </>
                  ) : (
                    t.settings.invite
                  )}
                </Button>
                {inviteStatus !== 'sent' && <span className="self-center text-sm text-destructive">{inviteStatus}</span>}
              </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
