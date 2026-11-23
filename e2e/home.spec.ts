import { expect, test } from '@playwright/test'

test('signed out, / is the homepage; the header switches language and theme', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gigs. Setlists. Riders. Sorted.')
  await expect(page.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/login')

  // Language: a cookie, so it sticks for the next page too.
  await page.getByRole('button', { name: 'Nederlands' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gigs. Setlists. Riders. Geregeld.')
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  // Theme: flips what's on screen, and is remembered.
  await page.goto('/')
  const html = page.locator('html')
  const before = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)
  await page.getByRole('button', { name: 'Switch between light and dark' }).click()
  await expect(html).toHaveAttribute('data-theme', before ? 'light' : 'dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', before ? 'light' : 'dark')
})
