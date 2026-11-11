import { expect, test } from '@playwright/test'
import { asReader, signIn } from './helpers'

test('admin adds a band with its first member, then deletes it', async ({ page }) => {
  await signIn(page, 'admin@example.com') // ADMIN_EMAILS in playwright.config.ts
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.locator('#user-menu').getByRole('link', { name: 'Admin' }).click()

  const name = `Band ${Date.now()}`
  await page.getByLabel('Band name').fill(name)
  await page.getByLabel("First member's email").fill('first@example.com')
  await page.getByRole('button', { name: 'Add band' }).click()
  const row = page.getByRole('listitem').filter({ hasText: name })
  await expect(row).toContainText('first@example.com')

  page.once('dialog', (d) => d.accept())
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).toHaveCount(0)
})

test.describe('non-admin', () => {
  test.use(asReader)
  test('cannot open the admin page', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add band' })).toHaveCount(0)
  })
})
