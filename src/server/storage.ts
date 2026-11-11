// File bytes: Vercel Blob (private) when BLOB_READ_WRITE_TOKEN is set, otherwise a local folder
// (dev/test). The database only keeps the key (files.blob_path).
//
// Blob mode: the browser uploads straight to Blob (a token from /api/files/upload; no size limit
// from Vercel's 4.5 MB request cap) and downloads via a short-lived signed URL.
// Local mode: bytes go through the server and are read from disk.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isLocal } from './db'

const dir = process.env.UPLOAD_DIR ?? '.uploads'
export const directUploads = !!process.env.BLOB_READ_WRITE_TOKEN

export const maxUploadBytes = 100 * 1024 * 1024

/** Keys are random UUIDs chosen by the client (blob mode) or the server (local mode). */
export const isFileKey = (key: string) => /^[0-9a-f-]{36}$/.test(key)

function assertLocal() {
  if (!isLocal) throw new Error('BLOB_READ_WRITE_TOKEN is not set. Add a Blob store to the Vercel project.')
}

export async function putLocalFile(key: string, data: Blob) {
  assertLocal()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, key), Buffer.from(await data.arrayBuffer()))
}

export const getLocalFile = (key: string) =>
  readFile(join(dir, key)).then(
    (b) => new Uint8Array(b),
    () => null,
  )

/** Size and type of an uploaded blob, or null if it isn't there. */
export async function blobInfo(key: string) {
  const { head } = await import('@vercel/blob')
  return head(key).then(
    (b) => ({ size: b.size, contentType: b.contentType }),
    () => null,
  )
}

/** A URL that works for a few minutes without a token. */
export async function signedDownloadUrl(key: string) {
  const { issueSignedToken, presignUrl } = await import('@vercel/blob')
  const validUntil = Date.now() + 5 * 60 * 1000
  const token = await issueSignedToken({ pathname: key, operations: ['get'], validUntil })
  return (await presignUrl(token, { operation: 'get', pathname: key, access: 'private', validUntil })).presignedUrl
}
