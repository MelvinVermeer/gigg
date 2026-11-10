// Server functions: thin wrappers that resolve the session and call ops.ts.
import { notFound, redirect } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from './auth'
import { db } from './db'
import { bandOps, Forbidden, myBands } from './ops'

const authed = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/login' })
  return next({ context: { userId: session.user.id } })
})

/** Forbidden → 404, so outsiders can't tell whether a band exists. */
async function orNotFound<T>(promise: Promise<T>) {
  try {
    return await promise
  } catch (e) {
    if (e instanceof Forbidden) throw notFound()
    throw e
  }
}

export const getMyBands = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => myBands(db, context.userId))

export const getBandPage = createServerFn({ method: 'GET' })
  .middleware([authed])
  .validator(z.object({ band: z.string() }))
  .handler(({ context, data }) =>
    orNotFound(
      Promise.all([
        bandOps.getBand(db, context.userId, data.band, {}),
        bandOps.listSongs(db, context.userId, data.band, {}),
      ]).then(([band, songs]) => ({ band, songs })),
    ),
  )
