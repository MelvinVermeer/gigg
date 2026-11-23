import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/server/auth'
import { db } from '#/server/db'
import { bandOps, Forbidden, NotFound } from '#/server/ops'
import { blobInfo, directUploads, isFileKey, maxUploadBytes, putLocalFile } from '#/server/storage'

const mb = maxUploadBytes / 1024 / 1024

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      /** How the browser should upload: straight to Blob, or through us (local mode). */
      GET: () => Response.json({ direct: directUploads, maxBytes: maxUploadBytes }),

      /**
       * Record an uploaded file on a song or event.
       * - JSON { band, song | event, key, name }: the browser already uploaded to Blob (blob mode).
       * - multipart { band, song | event, file }: local mode, the bytes come with the request.
       */
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Sign in first', { status: 401 })
        const userId = session.user.id
        try {
          if (request.headers.get('content-type')?.includes('application/json')) {
            const { band, song, event, key, name } = await request.json()
            if (!directUploads || !isFileKey(String(key))) return new Response('Bad request', { status: 400 })
            if ((await bandOps.getBand(db, userId, String(band), {})).role !== 'member') throw new Forbidden()
            const info = await blobInfo(key)
            if (!info) return new Response('Upload not found', { status: 400 })
            return Response.json(
              await bandOps.addFile(db, userId, band, { song, event, name, contentType: info.contentType, sizeBytes: info.size, blobPath: key }),
            )
          }

          if (directUploads) return new Response('Use direct uploads', { status: 400 })
          const form = await request.formData()
          const file = form.get('file')
          const band = String(form.get('band') ?? '')
          if (!(file instanceof File) || !file.size) return new Response('No file', { status: 400 })
          if (file.size > maxUploadBytes) return new Response(`Files can be up to ${mb} MB`, { status: 413 })
          // Members only, and the owner must exist, before any bytes are stored.
          const { role, storage } = await bandOps.getBand(db, userId, band, {})
          if (role !== 'member') throw new Forbidden()
          if (storage.limitBytes !== null && storage.usedBytes + file.size > storage.limitBytes) return new Response('storageFull', { status: 413 })
          const key = crypto.randomUUID()
          await putLocalFile(key, file)
          return Response.json(
            await bandOps.addFile(db, userId, band, {
              song: form.get('song') ?? undefined,
              event: form.get('event') ?? undefined,
              name: file.name,
              contentType: file.type || 'application/octet-stream',
              sizeBytes: file.size,
              blobPath: key,
          }),
          )
        } catch (e) {
          if (e instanceof Forbidden || e instanceof NotFound) return new Response('Not found', { status: 404 })
          if (e instanceof Error && e.message === 'storageFull') return new Response('storageFull', { status: 413 })
          throw e
        }
      },
    },
  },
})
