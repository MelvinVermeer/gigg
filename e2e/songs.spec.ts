import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('a member adds, renames and archives a song', async ({ page }) => {
  const title = `Test Song ${Date.now()}`
  await signIn(page, 'member@example.com')

  await page.getByRole('link', { name: 'Add song' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Duration').fill('3:45')
  await page.getByLabel('Key').fill('Am')
  await page.getByLabel('BPM').fill('120')
  await page.getByLabel(/Tags/).fill('ballad, cover')
  await page.getByRole('button', { name: 'Add song' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  await expect(page.locator('.fields')).toContainText('3:45')
  await expect(page.locator('.fields')).toContainText('ballad, cover')
  const oldUrl = page.url()

  // Rename: new URL, and the old one still leads to the song.
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Title').fill(`${title} (live)`)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} (live)`)
  expect(page.url()).not.toBe(oldUrl)
  await page.goto(oldUrl)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} (live)`)

  // Archive: gone from the list, visible under archived songs, restorable.
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('status')).toHaveText('This song is archived.')
  await page.getByRole('link', { name: 'All songs' }).click()
  await expect(page.getByRole('link', { name: `${title} (live)` })).toHaveCount(0)
  await page.getByRole('link', { name: 'Archived songs' }).click()
  await page.getByRole('link', { name: `${title} (live)` }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
})

test('a reader sees songs but no edit controls', async ({ page }) => {
  await signIn(page, 'reader@example.com')
  await expect(page.getByRole('link', { name: 'Closer' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add song' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Closer' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Closer')
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0)
})

test('song list on a phone has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await signIn(page, 'member@example.com')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
