// Server functions: resolve the session and call ops.ts. All band operations go through one
// function (runBandOp), so authorisation lives in exactly one place: bandOp() in ops.ts.
import { notFound, redirect } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders, getRequestUrl } from '@tanstack/react-start/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { dicts, emailLocale, isLocale, localeOf, requestLocale, type Locale } from '#/lib/i18n'
import { formatLongDate } from '#/lib/date'
import { currentBand } from '#/lib/current-band'
import { adminEmails, auth, isAdminEmail, signSignup, signupOpen } from './auth'
import { db, schema } from './db'
import { feedbackGoesPublic } from './github'
import { letter, sendMail } from './mail'
import { vapidPublicKey } from './push'
import { answerByToken, archiveBand, availabilityByToken, bandOps, createBand, deleteBandForever, Forbidden, listAllBands, listFeedback, myBands, NotFound, setFeedbackDone } from './ops'
import type { BandOpName, BandOps } from './ops'

const authed = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/login' })
  return next({ context: { userId: session.user.id } })
})

/**
 * The page language and the signed-in user (null when signed out) for the header. Public pages
 * call this too, so no redirect. Signed out, the language picked in the header (a cookie) decides,
 * else the browser's.
 */
export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) {
    return { signupOpen, locale: requestLocale(headers), user: null }
  }
  const { user } = session
  return {
    signupOpen,
    locale: localeOf(user.locale),
    user: { email: user.email, name: user.name, isAdmin: isAdminEmail(user.email), bands: await myBands(db, user.id) },
  }
})

/** Change your language (Settings). The page reloads after, so everything renders in it. */
export const setLocale = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator((data: { locale: string }) => data)
  .handler(async ({ context, data }) => {
    if (!isLocale(data.locale)) throw new Error('Unknown language')
    await db.update(schema.users).set({ locale: data.locale }).where(eq(schema.users.id, context.userId))
  })

/** Settings → Notifications: your choices (account-wide) and the key a device needs to sign up. */
export const getNotifications = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(async ({ context }) => {
    const [u] = await db
      .select({ asked: schema.users.notifyAsked, added: schema.users.notifyAdded })
      .from(schema.users)
      .where(eq(schema.users.id, context.userId))
    return { ...u, publicKey: vapidPublicKey }
  })

export const setNotifications = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ asked: z.boolean(), added: z.boolean() }))
  .handler(async ({ context, data }) => {
    await db.update(schema.users).set({ notifyAsked: data.asked, notifyAdded: data.added }).where(eq(schema.users.id, context.userId))
  })

const pushSubscription = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
})

/** Sign up this device (browser). An endpoint is one device: if someone else signed up here before, it's yours now. */
export const savePushSubscription = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(pushSubscription)
  .handler(async ({ context, data }) => {
    const row = { userId: context.userId, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth }
    await db.insert(schema.pushSubscriptions).values(row).onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: row })
  })

/** Logging out: this device stops getting your notifications. */
export const removePushSubscription = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ endpoint: z.string().max(2000) }))
  .handler(async ({ context, data }) => {
    await db
      .delete(schema.pushSubscriptions)
      .where(and(eq(schema.pushSubscriptions.endpoint, data.endpoint), eq(schema.pushSubscriptions.userId, context.userId)))
  })

// Instance admin (ADMIN_EMAILS). Others get a 404, like outsiders of a band.
const admin = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/login' })
  if (!isAdminEmail(session.user.email)) throw notFound()
  return next({ context: { locale: localeOf(session.user.locale) } })
})

export const getAllBands = createServerFn({ method: 'GET' })
  .middleware([admin])
  .handler(() => listAllBands(db))

export const getFeedback = createServerFn({ method: 'GET' })
  .middleware([admin])
  .handler(() => listFeedback(db))

export const markFeedback = createServerFn({ method: 'POST' })
  .middleware([admin])
  .validator((data: { id: string; done: boolean }) => data)
  .handler(({ data }) => setFeedbackDone(db, data.id, data.done))

/** "You're in the band" mail, for an admin-created band and for invites. */
function addedMail(locale: Locale, band: string, role: string, inviter: string | null) {
  const t = dicts[locale].mail
  return {
    subject: t.addedSubject(band),
    ...letter({
      kicker: t.addedKicker,
      title: band,
      lines: [t.addedText(inviter, role)],
      buttons: [{ label: t.addedButton, url: String(new URL('/login', getRequestUrl())) }],
      note: t.addedNote,
    }),
  }
}

export const addBand = createServerFn({ method: 'POST' })
  .middleware([admin])
  .validator((data: { name: string; email: string }) => data)
  .handler(async ({ context, data }) => {
    // A new first member gets the admin's language, like any invite.
    const band = await createBand(db, { ...data, locale: context.locale })
    const locale = emailLocale({ recipient: band.locale, inviter: context.locale })
    await sendMail({ to: band.email, locale, ...addedMail(locale, band.name, 'member', null) })
    return { slug: band.slug, name: band.name }
  })

export const deleteBand = createServerFn({ method: 'POST' })
  .middleware([admin])
  .validator((data: { slug: string }) => data)
  .handler(({ data }) => archiveBand(db, String(data.slug)))

/**
 * Self-service sign-up (OPEN_SIGNUP): mail a sign-in link whose callback carries the band name,
 * signed so only that link can create the band (api/signup.ts). Same response whether or not the email has an account.
 */
export const signUp = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().trim().toLowerCase().email().max(200), band: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    if (!signupOpen) throw notFound()
    const t = String(Date.now())
    const query = new URLSearchParams({ band: data.band, t, sig: signSignup([data.email, data.band, t]) })
    // Through the HTTP handler, not auth.api, so better-auth's rate limit applies like on /login.
    const headers = new Headers(getRequestHeaders())
    headers.set('content-type', 'application/json')
    headers.delete('content-length')
    const res = await auth.handler(
      new Request(new URL('/api/auth/sign-in/magic-link', getRequestUrl()), {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: data.email, callbackURL: `/api/signup?${query}` }),
      }),
    )
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? res.statusText)
  })

/** The band to open after sign-in: the one this device last had open (its cookie), else your first. */
export const getMyCurrentBand = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(async ({ context }) => {
    const band = currentBand(await myBands(db, context.userId), new Headers(getRequestHeaders()).get('cookie') ?? '')
    return band?.slug ?? null
  })

type OpCall = { band: string; op: string; input: unknown }

async function run(userId: string, data: OpCall, readOnly: boolean) {
  if (!Object.hasOwn(bandOps, data.op)) throw notFound()
  try {
    // Typed per operation by bandOp() below; the RPC layer itself is untyped.
    return (await bandOps[data.op as BandOpName](db, userId, data.band, data.input, readOnly)) as any
  } catch (e) {
    // Forbidden → 404 too, so outsiders can't tell whether a band exists.
    if (e instanceof Forbidden || e instanceof NotFound) throw notFound()
    throw e
  }
}

/** Reads go over GET so the service worker can cache them for offline use. */
const isRead = (op: string) => /^(get|list|search)/.test(op)

// GET runs in a read-only transaction: a cross-site GET can never change anything.
const runBandRead = createServerFn({ method: 'GET' })
  .middleware([authed])
  .validator((data: OpCall) => data)
  .handler(({ context, data }) => run(context.userId, data, true))

const runBandOp = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator((data: OpCall) => data)
  .handler(({ context, data }) => run(context.userId, data, false))

type Input<K extends BandOpName> = z.input<BandOps[K]['input']>
type Output<K extends BandOpName> = Awaited<ReturnType<BandOps[K]>>

/** Typed client for band operations: `bandOp('getSong', band, { slug })`. */
export function bandOp<K extends BandOpName>(op: K, band: string, input: Input<K>): Promise<Output<K>> {
  return (isRead(op) ? runBandRead : runBandOp)({ data: { band, op, input } }) as Promise<Output<K>>
}

export const deleteBandPermanently = createServerFn({ method: 'POST' })
  .middleware([admin])
  .validator((data: { slug: string }) => data)
  .handler(({ data }) => deleteBandForever(db, String(data.slug)))

/** Invite by email: add the membership (ops.ts checks the caller is a member), then mail them. */
export const inviteMember = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator((data: { band: string; email: string; role: string }) => data)
  .handler(async ({ context, data }) => {
    const invited = await run(context.userId, { band: data.band, op: 'inviteMember', input: { email: data.email, role: data.role } }, false)
    // A new account already got the inviter's language (inviteMember in ops.ts).
    const locale = emailLocale({ recipient: invited.locale })
    await sendMail({ to: invited.email, locale, ...addedMail(locale, invited.bandName, invited.role, invited.inviterName) })
    return invited
  })

/** Send feedback (ops.ts saves it); from someone who isn't an admin, it's mailed to every admin too. */
export const getFeedbackGoesPublic = createServerFn().handler(() => feedbackGoesPublic)

export const sendFeedback = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator((data: { band: string; body: string }) => data)
  .handler(async ({ context, data }) => {
    const sent = await run(context.userId, { band: data.band, op: 'sendFeedback', input: { body: data.body } }, false)
    if (isAdminEmail(sent.email) || !adminEmails.length) return
    const known = await db.select({ email: schema.users.email, locale: schema.users.locale }).from(schema.users).where(inArray(schema.users.email, adminEmails))
    for (const to of adminEmails) {
      const locale = emailLocale({ recipient: known.find((u) => u.email === to)?.locale })
      const t = dicts[locale].mail
      await sendMail({
        to,
        locale,
        subject: t.feedbackSubject(sent.band),
        ...letter({
          kicker: t.feedbackKicker,
          title: sent.band,
          lines: [t.feedbackFrom(sent.name, sent.email), ...sent.body.split('\n')],
          buttons: [{ label: t.feedbackButton, url: String(new URL('/admin', getRequestUrl())) }],
          note: t.feedbackNote,
        }),
      })
    }
  })

/** Ask whether people can make an event (everyone not asked yet, or one `user`): record it (ops.ts), then mail each their one-tap links. */
export const askAvailability = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator((data: { band: string; event: string; user?: string }) => data)
  .handler(async ({ context, data }) => {
    const asked = await run(context.userId, { band: data.band, op: 'askAvailability', input: { event: data.event, user: data.user } }, false)
    const { band, event } = asked
    for (const r of asked.recipients) {
      const locale = emailLocale({ recipient: r.locale })
      const t = dicts[locale]
      const when = formatLongDate(event.date, t.intl)
      const link = (answer: string) => new URL(`/availability/${r.token}?answer=${answer}`, getRequestUrl())
      await sendMail({
        to: r.email,
        locale,
        subject: t.mail.askSubject(event.title, when),
        ...letter({
          kicker: t.mail.askKicker,
          title: event.title,
          lines: [t.mail.askWhen(when, event.venue), t.mail.askText(band.name)],
          buttons: (['yes', 'maybe', 'no'] as const).map((a) => ({ label: t.answer[a], url: String(link(a)) })),
          note: t.mail.askOutro,
        }),
      })
    }
    return { sent: asked.recipients.length }
  })

// Answering from an emailed link needs no login: the token is the credential (see ops.ts).
const gone = () => {
  throw notFound()
}

export const getAvailabilityByToken = createServerFn({ method: 'GET' })
  .validator((data: { token: string }) => data)
  .handler(({ data }) => availabilityByToken(db, String(data.token)).catch((e) => (e instanceof NotFound ? gone() : Promise.reject(e))))

export const answerAvailabilityByToken = createServerFn({ method: 'POST' })
  .validator((data: { token: string; answer: string; note?: string }) => data)
  .handler(({ data }) =>
    answerByToken(db, String(data.token), { answer: data.answer, note: data.note }).catch((e) => (e instanceof NotFound ? gone() : Promise.reject(e))),
  )
