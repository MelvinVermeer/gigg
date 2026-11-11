import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/server/auth'
import { db } from '#/server/db'
import { fileForDownload, NotFound } from '#/server/ops'
import { directUploads, getLocalFile, signedDownloadUrl } from '#/server/storage'

/** Only these open in the browser; anything else (HTML, SVG, …) downloads, so uploads can't run scripts on our origin. */
const inline = /^(application\/pdf|image\/(png|jpeg|gif|webp)|audio\/|video\/|text\/plain)/

export const Route = createFileRoute('/api/files/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Sign in first', { status: 401 })
        if (!/^[0-9a-f-]{36}$/.test(params.id)) return new Response('Not found', { status: 404 })
        try {
          const file = await fileForDownload(db, session.user.id, params.id)
          // Blob mode: hand over a short-lived link, so big files don't pass through a function.
          if (directUploads) return Response.redirect(await signedDownloadUrl(file.blobPath), 302)
          const body = await getLocalFile(file.blobPath)
          if (!body) return new Response('Not found', { status: 404 })
          return new Response(body, {
            headers: {
              'content-type': file.contentType,
              'content-disposition': `${inline.test(file.contentType) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
              'x-content-type-options': 'nosniff',
              'content-security-policy': 'sandbox',
              'cache-control': 'private, max-age=0, must-revalidate',
            },
          })
        } catch (e) {
          if (e instanceof NotFound) return new Response('Not found', { status: 404 })
          throw e
        }
      },
    },
  },
})
