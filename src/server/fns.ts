// Server functions: resolve the session and call ops.ts. All band operations go through one
// function (runBandOp), so authorisation lives in exactly one place: bandOp() in ops.ts.
import { notFound, redirect } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders, getRequestUrl } from '@tanstack/react-start/server'
import type { z } from 'zod'
import { auth, isAdminEmail } from './auth'
import { db } from './db'
import { sendMail } from './mail'
import { archiveBand, bandOps, createBand, deleteBandForever, Forbidden, listAllBands, listFeedback, myBands, NotFound } from './ops'
import type { BandOpName, BandOps } from './ops'

const authed = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/login' })
  return next({ context: { userId: session.user.id } })
})

/** The signed-in user for the header, or null. Public pages call this too, so no redirect. */
export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) return null
  return { email: session.user.email, isAdmin: isAdminEmail(session.user.email), bands: await myBands(db, session.user.id) }
})

// Instance admin (ADMIN_EMAILS). Others get a 404, like outsiders of a band.
const admin = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/login' })
  if (!isAdminEmail(session.user.email)) throw notFound()
  return next()
})

export const getAllBands = createServerFn({ method: 'GET' })
  .middleware([admin])
  .handler(() => listAllBands(db))

export const getFeedback = createServerFn({ method: 'GET' })
  .middleware([admin])
  .handler(() => listFeedback(db))

export const addBand = createServerFn({ method: 'POST' })
  .middleware([admin])
  .validator((data: { name: string; email: string }) => data)
  .handler(async ({ data }) => {
    const band = await createBand(db, data)
    const email = data.email.trim().toLowerCase()
    await sendMail({
      to: email,
      subject: `You've been added to ${band.name} on Gigg`,
      text: `You're now a member of ${band.name} on Gigg: gigs, setlists and riders for bands.\n\nSign in with ${email}: ${new URL('/login', getRequestUrl())}`,
    })
    return band
  })

export const deleteBand = createServerFn({ method: 'POST' })
  .middleware([admin])
  .validator((data: { slug: string }) => data)
  .handler(({ data }) => archiveBand(db, String(data.slug)))

export const getMyBands = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => myBands(db, context.userId))

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
    await sendMail({
      to: invited.email,
      subject: `You've been added to ${invited.bandName} on Gigg`,
      text: `You're now ${invited.role === 'member' ? 'a member' : 'a reader'} of ${invited.bandName} on Gigg: gigs, setlists and riders for bands.\n\nSign in with ${invited.email}: ${new URL('/login', getRequestUrl())}`,
    })
    return invited
  })
