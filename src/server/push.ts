// Push notifications (Settings → Notifications): Web Push signed with the VAPID keys.
// Without keys (local mode) they're only logged.
import { and, eq, inArray } from 'drizzle-orm'
import webpush from 'web-push'
import { formatLongDate, formatTimes } from '#/lib/date'
import { dicts, localeOf } from '#/lib/i18n'
import type { Db } from './db'
import { bands, events, pushSubscriptions, users } from './db/schema'

export type PushKind = 'asked' | 'added'

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
/** Browsers need it to sign up a device (applicationServerKey). Empty: push isn't set up. */
export const vapidPublicKey = VAPID_PUBLIC_KEY ?? ''
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:no-reply@gigg.band', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

/** One message per device: these people, except whoever acted, if they turned this kind on. In their language. */
export async function pushMessages(db: Db, kind: PushKind, eventId: string, userIds: string[], actorId: string) {
  const ids = userIds.filter((id) => id !== actorId)
  if (!ids.length) return []
  const subs = await db
    .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth, locale: users.locale })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId))
    .where(and(inArray(users.id, ids), eq(kind === 'asked' ? users.notifyAsked : users.notifyAdded, true)))
  if (!subs.length) return []
  const [event] = await db
    .select({ id: events.id, title: events.title, slug: events.slug, date: events.date, startTime: events.startTime, endTime: events.endTime, band: bands.name, bandSlug: bands.slug })
    .from(events)
    .innerJoin(bands, eq(bands.id, events.bandId))
    .where(eq(events.id, eventId))
  return subs.map((s) => {
    const t = dicts[localeOf(s.locale)]
    const when = [formatLongDate(event.date, t.intl), formatTimes(event.startTime, event.endTime)].filter(Boolean).join(', ')
    return {
      subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload: {
        title: kind === 'asked' ? t.notifications.pushAsked(event.title) : t.notifications.pushAdded(event.title),
        body: `${event.band} · ${when}`,
        url: `/${event.bandSlug}/events/${event.slug}`,
        // Same tag per event: being asked replaces the "added" notification instead of stacking (public/sw.js).
        tag: `event-${event.id}`,
      },
    }
  })
}

/** Send, never throw: a failed push must not undo the change. Devices that are gone get removed. */
export async function sendPush(db: Db, kind: PushKind, eventId: string, userIds: string[], actorId: string) {
  const messages = await pushMessages(db, kind, eventId, userIds, actorId)
  await Promise.all(
    messages.map(async ({ subscription, payload }) => {
      if (!VAPID_PRIVATE_KEY) return console.log(`[push] ${payload.title}: ${payload.body}`)
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 24 * 7 })
      } catch (e) {
        // 404/410: uninstalled, permission revoked or expired.
        if (e instanceof webpush.WebPushError && (e.statusCode === 404 || e.statusCode === 410))
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        else console.error('[push]', e)
      }
    }),
  )
}
