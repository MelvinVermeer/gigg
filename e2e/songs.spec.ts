import { expect, test } from '@playwright/test'
import { asMember, asReader } from './helpers'

test.describe('member', () => {
  test.use(asMember)

  test('imports songs from Settings, and a CSV dropped on the song list', async ({ page }) => {
    const title = `Imported ${Date.now()}`
    await page.goto('/demo-band/settings')
    await page.getByRole('button', { name: 'Import' }).click()
    await page.getByLabel('Or paste here').fill(`Song;Tempo;Singer\n${title};fast;Anna`)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByLabel('Where “Song” goes')).toHaveValue('field:title')
    await expect(page.getByText('1 not understood, e.g. “fast”')).toBeVisible()
    await page.getByRole('button', { name: 'Import 1 row' }).click()
    await expect(page.getByText('1 created, 0 updated, 0 skipped.')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto('/demo-band/songs')
    await page.getByRole('link', { name: title }).click()
    await expect(page.locator('.notes')).toContainText('Singer: Anna')

    // A plain list of titles dropped on the list: straight to the mapping step, no header row.
    await page.goto('/demo-band/songs')
    const drop = await page.evaluateHandle((text) => {
      const dt = new DataTransfer()
      dt.items.add(new File([text], 'list.csv', { type: 'text/csv' }))
      return dt
    }, `${title} two\n${title} three`)
    await page.locator('table.songs').dispatchEvent('drop', { dataTransfer: drop })
    await page.getByRole('button', { name: 'Import 2 rows' }).click()
    await expect(page.getByText('2 created, 0 updated, 0 skipped.')).toBeVisible()
    await expect(page.getByText('Want to import more?')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('link', { name: `${title} three` })).toBeVisible()
  })

  test('adds, renames and archives a song', async ({ page }) => {
    const title = `Test Song ${Date.now()}`
    await page.goto('/demo-band/songs')

    await page.getByRole('link', { name: 'Add song' }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Duration').fill('3:45')
    await page.getByLabel('Key').fill('Am')
    await page.getByLabel('BPM').fill('120')
    await page.getByLabel(/Tags/).fill('ballad, cover')
    await page.getByLabel('Notes').fill('Capo **2**\nslow intro\n\n- [ ] new strings\n\n<b id="raw">raw</b>')
    await page.getByLabel('Lyrics').fill('**Verse**\nFirst line\nSecond line')
    await page.getByRole('button', { name: 'Add song' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    // Lyrics: markdown, every line break kept.
    await expect(page.getByRole('heading', { name: 'Lyrics' })).toBeVisible()
    await expect(page.locator('.lyrics p')).toHaveText('Verse\nFirst line\nSecond line', { useInnerText: true })
    await expect(page.locator('.fields')).toContainText('3:45')
    await expect(page.locator('.fields')).toContainText('ballad, cover')
    // Notes render as markdown; single line breaks stay, raw HTML doesn't render.
    const notes = page.locator('.notes')
    await expect(notes.locator('strong')).toHaveText('2')
    await expect(notes.locator('p').first()).toHaveText('Capo 2\nslow intro', { useInnerText: true })
    await expect(notes.getByRole('checkbox')).toBeVisible()
    await expect(page.locator('#raw')).toHaveCount(0)
    const oldUrl = page.url()

    // Rename: new URL, and the old one still leads to the song.
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByLabel('Title').fill(`${title} (live)`)
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} (live)`)
    expect(page.url()).not.toBe(oldUrl)
    await page.goto(oldUrl)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} (live)`)

    // Archive (on the edit form): gone from the list, nothing links to archived songs except the manual, restorable.
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Songs')
    await expect(page.getByRole('link', { name: `${title} (live)` })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Archived/ })).toHaveCount(0)
    await page.goto('/manual')
    await page.getByRole('link', { name: 'Archived songs' }).click()
    await page.getByRole('link', { name: `${title} (live)` }).click()
    await expect(page.getByRole('status')).toHaveText('This song is archived.')
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('song list on a phone has no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/demo-band/songs')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Songs')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('reader', () => {
  test.use(asReader)

  test('sees songs but no edit controls', async ({ page }) => {
    await page.goto('/demo-band/songs')
    await expect(page.getByRole('link', { name: 'Closer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add song' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Closer' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Closer')
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0)
  })

  test('can export songs from Settings, not import', async ({ page }) => {
    await page.goto('/demo-band/settings')
    await expect(page.getByRole('button', { name: 'Import' })).toHaveCount(0)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    expect((await download).suggestedFilename()).toBe('demo-band-songs.csv')
  })
})
