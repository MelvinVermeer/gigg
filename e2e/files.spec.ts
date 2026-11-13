import { expect, test } from '@playwright/test'
import { asMember, asReader } from './helpers'

test.describe('member', () => {
  test.use(asMember)

  test('uploads files to a song and an event, downloads one, removes one', async ({ page }) => {
    for (const path of ['/demo-band/songs/closer', '/demo-band/events/summer-party']) {
      await page.goto(path)
      const name = `chords-${Date.now()}.txt`
      await page.getByLabel('Add files').setInputFiles([
        { name, mimeType: 'text/plain', buffer: Buffer.from('chord chart') },
        { name: `second-${name}`, mimeType: 'text/plain', buffer: Buffer.from('two') },
      ])
      const link = page.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      await expect(page.getByRole('link', { name: `second-${name}`, exact: true })).toBeVisible()
      const res = await page.request.get((await link.getAttribute('href'))!)
      expect(await res.text()).toBe('chord chart')

      page.once('dialog', (d) => d.accept())
      await page.getByRole('listitem').filter({ hasText: `second-${name}` }).getByRole('button', { name: 'Remove' }).click()
      await expect(page.getByRole('link', { name: `second-${name}`, exact: true })).toHaveCount(0)
      await expect(link).toBeVisible()
    }
  })
})

test.describe('search', () => {
  test.use(asMember)

  test('finds a file by name and links straight to it', async ({ page }) => {
    await page.goto('/demo-band/songs/closer')
    const name = `setplot-${Date.now()}.txt`
    await page.getByLabel('Add files').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('plot') })
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible()

    await page.getByRole('searchbox').fill(name)
    const files = page.locator('section', { has: page.getByRole('heading', { name: 'Files' }) })
    await expect(files.getByRole('listitem')).toContainText(`${name} · Song · Closer`)
    await expect(files.getByRole('link', { name })).toHaveAttribute('href', /^\/api\/files\/[0-9a-f-]{36}$/)
  })
})

test.describe('big file', () => {
  test.use(asMember)

  test('uploads a file over the old 4 MB limit', async ({ page }) => {
    await page.goto('/demo-band/songs/closer')
    const name = `big-${Date.now()}.bin`
    await page.getByLabel('Add files').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.alloc(6 * 1024 * 1024, 1) })
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: name })).toContainText('6.0 MB')
  })
})

test.describe('reader', () => {
  test.use(asReader)

  test('cannot upload', async ({ page }) => {
    await page.goto('/demo-band/songs/closer')
    await expect(page.getByLabel('Add files')).toHaveCount(0)
    const res = await page.request.post('/api/files', { multipart: { band: 'demo-band', song: 'closer', file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') } } })
    expect(res.status()).toBe(404)
  })
})
