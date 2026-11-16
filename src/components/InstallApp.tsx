import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { installApp, useCanInstall } from '#/lib/install'
import { useT } from '#/lib/i18n'

const DISMISSED = 'install-banner-dismissed'

/** Settings → You: install Gigg as an app. Hidden when the browser can't, or it already is. */
export function InstallButton() {
  const t = useT()
  return useCanInstall() ? (
    <div className="grid gap-3">
      <h3 className="mb-0 text-sm font-medium">{t.install.title}</h3>
      <p className="text-sm text-muted-foreground">{t.install.banner}</p>
      <Button variant="outline" size="sm" className="justify-self-start" onClick={installApp}>
        {t.install.button}
      </Button>
    </div>
  ) : null
}

/** A strip under the header suggesting the install; "Not now" hides it on this device (the settings button stays). */
export function InstallBanner() {
  const t = useT()
  const canInstall = useCanInstall()
  const [hidden, setHidden] = useState(() => {
    try {
      return !!localStorage.getItem(DISMISSED)
    } catch {
      return false
    }
  })
  if (!canInstall || hidden) return null
  return (
    <div className="border-b bg-muted/50">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <span className="flex-1">{t.install.banner}</span>
        <Button size="sm" onClick={installApp}>
          {t.install.button}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED, '1')
            } catch {}
            setHidden(true)
          }}
        >
          {t.install.later}
        </Button>
      </div>
    </div>
  )
}
