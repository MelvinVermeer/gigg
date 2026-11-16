// This device's push sign-up (Settings → Notifications). public/sw.js shows the notifications.
import { removePushSubscription, savePushSubscription } from '#/server/fns'

/** unsupported: no Web Push here (e.g. iOS outside the home-screen app); blocked: permission denied. */
export type DeviceState = 'unsupported' | 'blocked' | 'off' | 'on'

const supported = (publicKey: string) =>
  !!publicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const current = async () => (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()) ?? null

const save = (sub: PushSubscription) => savePushSubscription({ data: sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } } })

export async function deviceState(publicKey: string): Promise<DeviceState> {
  if (!supported(publicKey)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const sub = Notification.permission === 'granted' ? await current() : null
  if (sub) await save(sub) // heals a sign-up the server dropped
  return sub ? 'on' : 'off'
}

/** Call straight from a click: browsers only show the permission prompt for a user gesture. */
export async function enableDevice(publicKey: string): Promise<DeviceState> {
  if (!supported(publicKey)) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  await navigator.serviceWorker.register('/sw.js') // production registers it on load; dev doesn't
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) }))
  await save(sub)
  return 'on'
}

/** Logging out: this device stops getting the user's notifications. Call before signing out. */
export async function forgetDevice() {
  const sub = 'serviceWorker' in navigator ? await current().catch(() => null) : null
  if (!sub) return
  await removePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}

function fromBase64Url(s: string) {
  const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
