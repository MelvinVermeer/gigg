import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/server/auth'
import { db } from '#/server/db'
import { bandOps, Forbidden, NotFound } from '#/server/ops'
import { maxUploadBytes, putFile } from '#/server/storage'

/** Upload one file to a song or event: multipart with band, song | event, file. */
export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Sign in first', { status: 401 })
        const form = await request.formData()
        const file = form.get('file')
        const band = String(form.get('band') ?? '')
        if (!(file instanceof File) || !file.size) return new Response('No file', { status: 400 })
        if (file.size > maxUploadBytes) return new Response(`Files can be up to ${maxUploadBytes / 1024 / 1024} MB`, { status: 413 })
        const owner = { song: form.get('song') ?? undefined, event: form.get('event') ?? undefined }
        const blobPath = crypto.randomUUID()
        try {
          // Members only, and the owner must exist, before any bytes are stored.
          if ((await bandOps.getBand(db, session.user.id, band, {})).role !== 'member') throw new Forbidden()
          await putFile(blobPath, file, file.type || 'application/octet-stream')
          const row = await bandOps.addFile(db, session.user.id, band, {
            ...owner,
            name: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            blobPath,
          })
          return Response.json(row)
        } catch (e) {
          if (e instanceof Forbidden || e instanceof NotFound) return new Response('Not found', { status: 404 })
          throw e
        }
      },
    },
  },
})
