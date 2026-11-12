import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'
import { useT } from '#/lib/i18n'

const DISMISSED = 'passkey-prompt-dismissed'

/**
 * After an email-link sign-in (login.tsx adds ?passkey=suggest to the link), offer a passkey
 * so the next sign-in skips the email. Not shown if the user already has one, or said "later" on this device.
 */
export function PasskeyPrompt() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = new URL(location.href)
    if (!url.searchParams.has('passkey')) return
    url.searchParams.delete('passkey')
    history.replaceState(history.state, '', url)
    try {
      if (localStorage.getItem(DISMISSED)) return
    } catch {}
    authClient.passkey.listUserPasskeys().then((res) => {
      if (res.data?.length === 0) setOpen(true)
    })
  }, [])

  async function add() {
    const res = await authClient.passkey.addPasskey({ name: deviceName(navigator.userAgent, t.passkey.deviceOn) })
    if (res?.error) setError(res.error.message ?? t.passkey.couldNotAdd)
    else setOpen(false)
  }

  function later() {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {}
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : later())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.passkey.promptTitle}</DialogTitle>
          <DialogDescription>{t.passkey.promptText}</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={later}>
            {t.passkey.later}
          </Button>
          <Button onClick={add}>{t.passkey.add}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
