import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Label } from '#/components/ui/label'
import { errorText, useT } from '#/lib/i18n'
import { deviceState, enableDevice } from '#/lib/push'
import type { DeviceState } from '#/lib/push'
import { setNotifications } from '#/server/fns'

type Prefs = { asked: boolean; added: boolean }

/** Settings → You → Notifications: two account-wide choices; turning one on signs up this device too. */
export function NotificationSettings({ initial, publicKey }: { initial: Prefs; publicKey: string }) {
  const t = useT()
  const [prefs, setPrefs] = useState(initial)
  // null until checked in the browser
  const [device, setDevice] = useState<DeviceState | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    deviceState(publicKey).then(setDevice, () => setDevice('unsupported'))
  }, [publicKey])

  function enable() {
    enableDevice(publicKey).then(setDevice, (e) => setError(errorText(t, e, t.common.somethingWrong)))
  }

  async function toggle(kind: keyof Prefs, on: boolean) {
    // First, while still inside the click: the permission prompt needs it.
    if (on && device === 'off') enable()
    const next = { ...prefs, [kind]: on }
    setPrefs(next)
    try {
      await setNotifications({ data: next })
      setError('')
    } catch (e) {
      setPrefs(prefs)
      setError(errorText(t, e, t.settings.couldNotSave))
    }
  }

  const anyOn = prefs.asked || prefs.added
  return (
    <div className="grid gap-3">
      <h3 className="mb-0 text-sm font-medium">{t.notifications.title}</h3>
      <p className="text-sm text-muted-foreground">{t.notifications.intro}</p>
      {(['asked', 'added'] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-2">
          <Checkbox id={`notify-${kind}`} checked={prefs[kind]} onCheckedChange={(c) => toggle(kind, c === true)} />
          <Label htmlFor={`notify-${kind}`}>{t.notifications[kind]}</Label>
        </div>
      ))}
      {anyOn && device === 'off' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.notifications.notOnDevice}</span>
          <Button variant="outline" size="sm" onClick={enable}>
            {t.notifications.enable}
          </Button>
        </div>
      )}
      {anyOn && (device === 'blocked' || device === 'unsupported') && (
        <p role="status" className="text-sm text-muted-foreground">
          {t.notifications[device]}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
