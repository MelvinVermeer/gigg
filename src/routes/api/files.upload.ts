import { createFileRoute } from '@tanstack/react-router'
import { handleUpload } from '@vercel/blob/client'
import type { HandleUploadBody } from '@vercel/blob/client'
import { auth } from '#/server/auth'
import { db } from '#/server/db'
import { bandOps, Forbidden, NotFound } from '#/server/ops'
import { isFileKey, maxUploadBytes } from '#/server/storage'

/** Gives a signed-in band member a token to upload one file straight to Blob (blob mode only). */
export const Route = createFileRoute('/api/files/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Sign in first', { status: 401 })
        try {
          return Response.json(
            await handleUpload({
              request,
              body: (await request.json()) as HandleUploadBody,
              onBeforeGenerateToken: async (pathname, clientPayload) => {
                const { band } = JSON.parse(clientPayload ?? '{}')
                if ((await bandOps.getBand(db, session.user.id, String(band), {})).role !== 'member') throw new Forbidden()
                if (!isFileKey(pathname)) throw new Error('Bad key')
                return { maximumSizeInBytes: maxUploadBytes, addRandomSuffix: false }
              },
            }),
          )
        } catch (e) {
          if (e instanceof Forbidden || e instanceof NotFound) return new Response('Not found', { status: 404 })
          return new Response(e instanceof Error ? e.message : 'Upload failed', { status: 400 })
        }
      },
    },
  },
})
