// File bytes: Vercel Blob (private) when BLOB_READ_WRITE_TOKEN is set, otherwise a local folder
// (dev/test). The database only keeps the key (files.blob_path).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isLocal } from './db'

const dir = process.env.UPLOAD_DIR ?? '.uploads'
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN

/** Vercel Functions reject request bodies over 4.5 MB. ponytail: direct-to-Blob client uploads for bigger files. */
export const maxUploadBytes = 4 * 1024 * 1024

export async function putFile(key: string, data: Blob, contentType: string) {
  if (useBlob) {
    const { put } = await import('@vercel/blob')
    await put(key, data, { access: 'private', contentType, addRandomSuffix: false })
    return
  }
  if (!isLocal) throw new Error('BLOB_READ_WRITE_TOKEN is not set. Add a Blob store to the Vercel project.')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, key), Buffer.from(await data.arrayBuffer()))
}

/** The file's bytes, or null if missing. */
export async function getFile(key: string): Promise<BodyInit | null> {
  if (useBlob) {
    const { get } = await import('@vercel/blob')
    const res = await get(key, { access: 'private' })
    return res?.statusCode === 200 ? res.stream : null
  }
  return readFile(join(dir, key)).then(
    (b) => new Uint8Array(b),
    () => null,
  )
}
