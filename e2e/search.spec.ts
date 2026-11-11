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

  // A venue result opens its row on the venues page.
  await page.goBack()
  await expect(box).toHaveValue('closr')

  // Clearing the box goes back to where the search started.
  await box.fill('')
  await expect(page).toHaveURL(/\/demo-band\/events$/)

  await page.getByRole('searchbox').fill('local hall')
  const events = page.locator('section', { has: page.getByRole('heading', { name: 'Events' }) })
  await expect(events.getByRole('link', { name: 'Summer Party' })).toBeVisible()
  await page.locator('section', { has: page.getByRole('heading', { name: 'Venues' }) }).getByRole('link', { name: 'The Local Hall' }).click()
  await expect(page).toHaveURL(/\/settings\/venues#[0-9a-f-]{36}$/)
  await expect(page.locator('ul.records li', { hasText: 'The Local Hall' }).locator('details')).toHaveAttribute('open', '')

  await page.goto('/demo-band/search?q=zzzzqqq')
  await expect(page.getByText('Nothing found for “zzzzqqq”.')).toBeVisible()
})
