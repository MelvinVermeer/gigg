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

export const getMyBands = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => myBands(db, context.userId))

const runBandOp = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator((data: { band: string; op: string; input: unknown }) => data)
  .handler(async ({ context, data }) => {
    if (!Object.hasOwn(bandOps, data.op)) throw notFound()
    try {
      // Typed per operation by bandOp() below; the RPC layer itself is untyped.
      return (await bandOps[data.op as BandOpName](db, context.userId, data.band, data.input)) as any
    } catch (e) {
      // Forbidden → 404 too, so outsiders can't tell whether a band exists.
      if (e instanceof Forbidden || e instanceof NotFound) throw notFound()
      throw e
    }
  })

type Input<K extends BandOpName> = z.input<BandOps[K]['input']>
type Output<K extends BandOpName> = Awaited<ReturnType<BandOps[K]>>

/** Typed client for band operations: `bandOp('getSong', band, { slug })`. */
export function bandOp<K extends BandOpName>(op: K, band: string, input: Input<K>): Promise<Output<K>> {
  return runBandOp({ data: { band, op, input } }) as Promise<Output<K>>
}
