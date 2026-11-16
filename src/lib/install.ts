import { useSyncExternalStore } from 'react'

// Chrome's install prompt, kept until the user clicks Install (it can fire before any component mounts).
type Deferred = Event & { prompt: () => Promise<unknown> }
let deferred: Deferred | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as Deferred
    emit()
  })
  addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

// navigator.install() is the newer API (modern-web-guidance: install-web-app); the deferred prompt covers Chrome without it.
const webInstall = () => (typeof navigator !== 'undefined' && 'install' in navigator ? (navigator as unknown as { install: () => Promise<void> }).install : null)
const canInstall = () => !matchMedia('(display-mode: standalone)').matches && !!(webInstall() || deferred)

/** Whether this browser can install Gigg right now: false once installed or when opened as the app. iOS has no API, so it never shows. */
export const useCanInstall = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), canInstall, () => false)

/** Call straight from a click: both APIs need that user gesture. Cancelling is a normal choice, not an error. */
export async function installApp() {
  try {
    const install = webInstall()
    if (install) await install.call(navigator)
    else await deferred?.prompt()
  } catch {}
  deferred = null // a prompt event can be used once
  emit()
}
