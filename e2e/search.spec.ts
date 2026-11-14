import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

test.use(asReader)

test('search as you type, with typos; results link to the right place', async ({ page }) => {
  await page.goto('/demo-band')
  const box = page.getByRole('searchbox')

  await box.fill('closr')
  const songs = page.locator('section', { has: page.getByRole('heading', { name: 'Songs' }) })
  await expect(songs.getByRole('link', { name: 'Closer' })).toBeVisible()
  await expect(page).toHaveURL(/\/demo-band\/search\?q=closr$/)

  await songs.getByRole('link', { name: 'Closer' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Closer')

  await page.goBack()
  await expect(box).toHaveValue('closr')

  // Clearing the box goes back to where the search started.
  await box.fill('')
  await expect(page).toHaveURL(/\/demo-band\/events$/)

  await page.getByRole('searchbox').fill('local hall')
  const events = page.locator('section', { has: page.getByRole('heading', { name: 'Events' }) })
  await expect(events.getByRole('link', { name: 'Summer Party' })).toBeVisible()
  await page.locator('section', { has: page.getByRole('heading', { name: 'Venues' }) }).getByRole('link', { name: 'The Local Hall' }).click()
  // A venue result opens the venue's page.
  await expect(page).toHaveURL(/\/demo-band\/venues\/the-local-hall$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Local Hall')

  await page.goto('/demo-band/search?q=zzzzqqq')
  await expect(page.getByText('Nothing found for “zzzzqqq”.')).toBeVisible()
})
