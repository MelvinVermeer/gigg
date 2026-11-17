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

      // Our own confirm dialog: Cancel keeps the file, Remove removes it.
      const remove = page.getByRole('listitem').filter({ hasText: `second-${name}` }).getByRole('button', { name: 'Remove' })
      await remove.click()
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await remove.click()
      await expect(page.getByRole('dialog')).toContainText(`Remove second-${name}?`)
      await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
      await expect(page.getByRole('link', { name: `second-${name}`, exact: true })).toHaveCount(0)
      await expect(link).toBeVisible()
    }
  })
})

test.describe('drop zone', () => {
  test.use(asMember)

  test('dropping files on the card uploads them; it is outlined while dragging', async ({ page }) => {
    await page.goto('/demo-band/songs/closer')
    const name = `dropped-${Date.now()}.txt`
    const card = page.getByRole('region', { name: 'Files' })
    const dt = await page.evaluateHandle((name) => {
      const dt = new DataTransfer()
      dt.items.add(new File(['dropped'], name, { type: 'text/plain' }))
      return dt
    }, name)
    await card.dispatchEvent('dragover', { dataTransfer: dt })
    await expect(card).toHaveClass(/outline-dashed/)
    await card.dispatchEvent('drop', { dataTransfer: dt })
    await expect(card).not.toHaveClass(/outline-dashed/)
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
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
    const row = page.getByRole('listitem').filter({ hasText: name })
    await expect(row.getByText('(6.0 MB)')).toBeVisible()
    await page.setViewportSize({ width: 375, height: 700 })
    await expect(row.getByText('(6.0 MB)')).toBeHidden() // no room on a phone
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

/** Silence as a WAV, so the browser has something real to play. */
function wav(seconds = 1) {
  const rate = 8000
  const data = rate * 2 * seconds
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + data, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(1, 22) // mono
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(data, 40)
  return b
}

test.describe('audio', () => {
  test.use(asMember)

  test('plays audio files from the song and from a setlist; one at a time', async ({ page }) => {
    await page.goto('/demo-band/songs/closer')
    const a = `demo-${Date.now()}.wav`
    const b = `live-${Date.now()}.wav`
    await page.getByLabel('Add files').setInputFiles([
      { name: a, mimeType: 'audio/wav', buffer: wav(20) },
      { name: b, mimeType: 'audio/wav', buffer: wav() },
    ])
    // Song page: a play button per audio file, no next.
    await page.getByRole('button', { name: `Play ${a}` }).click()
    const player = page.getByRole('group', { name: `Playing ${a}` })
    await expect(player.getByRole('button', { name: 'Restart' })).toBeVisible()
    await expect(player.getByRole('button', { name: 'Next recording' })).toHaveCount(0)
    // Seeking jumps there (the file is served in ranges), it doesn't start over.
    await expect(player).toContainText('0:20')
    await player.getByRole('slider', { name: 'Position' }).fill('15')
    await expect(player).toContainText(/0:1[5-9] \/ 0:20/)
    // Dragging moves only the slider; the audio jumps once, on release.
    const box = (await player.getByRole('slider', { name: 'Position' }).boundingBox())!
    const audioAt = () => page.locator('audio[src]').evaluate((el: HTMLAudioElement) => el.currentTime)
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 5 })
    await expect(player).toContainText(/^.*0:0\d \/ 0:20/)
    expect(await audioAt()).toBeGreaterThan(14)
    await page.mouse.up()
    await expect.poll(audioAt).toBeLessThan(5)
    // Starting the other one stops the first.
    await page.getByRole('button', { name: `Play ${b}` }).click()
    await expect(page.getByRole('group', { name: `Playing ${b}` })).toBeVisible()
    await expect(player).toHaveCount(0)
    await page.getByRole('group', { name: `Playing ${b}` }).getByRole('button', { name: 'Stop' }).click()
    await expect(page.getByRole('button', { name: `Play ${b}` })).toBeVisible()

    // Setlist: one button per song; with several recordings it asks which, and next steps through them.
    await page.goto('/demo-band/setlists')
    await page.getByRole('link', { name: 'Standard 2 sets' }).click()
    await page.getByRole('button', { name: 'Play Closer' }).click()
    await page.getByRole('menuitem', { name: a }).click()
    await expect(page.getByRole('group', { name: `Playing ${a}` })).toBeVisible()
    await page.getByRole('button', { name: 'Next recording' }).click()
    await expect(page.getByRole('group', { name: `Playing ${b}` })).toBeVisible()
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(page.getByRole('button', { name: 'Play Closer' })).toBeVisible()

    // Hidden by unticking it in Settings.
    await page.goto('/demo-band/settings')
    await expect(page.getByLabel('Show Play button in Show mode')).toBeDisabled()
    await page.getByLabel('Show Play button in Page').uncheck()
    await page.goto('/demo-band/setlists')
    await page.getByRole('link', { name: 'Standard 2 sets' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play Closer' })).toHaveCount(0)
    await page.goto('/demo-band/settings')
    await page.getByLabel('Show Play button in Page').check()
  })
})
