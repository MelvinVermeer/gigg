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
                const { band, size } = JSON.parse(clientPayload ?? '{}')
                const { role, storage } = await bandOps.getBand(db, session.user.id, String(band), {})
                if (role !== 'member') throw new Forbidden()
                if (!isFileKey(pathname)) throw new Error('Bad key')
                // The quota: refuse a declared size that doesn't fit, and let Blob hold the upload to what's left.
                const left = storage.limitBytes === null ? maxUploadBytes : Math.min(maxUploadBytes, storage.limitBytes - storage.usedBytes)
                if (left <= 0 || !(Number(size) <= left)) throw new Error('storageFull')
                return { maximumSizeInBytes: left, addRandomSuffix: false }
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
