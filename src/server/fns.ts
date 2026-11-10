// Server functions: resolve the session and call ops.ts. All band operations go through one
// function (runBandOp), so authorisation lives in exactly one place: bandOp() in ops.ts.
import { notFound, redirect } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { z } from 'zod'
import { auth } from './auth'
import { db } from './db'
import { bandOps, Forbidden, myBands, NotFound } from './ops'
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
  return { email: session.user.email, bands: await myBands(db, session.user.id) }
})

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
