import { expect, test } from '@playwright/test'
import { asReader, lastLinkFor, signIn } from './helpers'

test('admin adds a band, its first member is invited, then the band is deleted for good', async ({ page, browser }) => {
  await signIn(page, 'admin@example.com') // ADMIN_EMAILS in playwright.config.ts
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.locator('#user-menu').getByRole('link', { name: 'Admin' }).click()

  const name = `Band ${Date.now()}`
  const email = `first-${Date.now()}@example.com`
  await page.getByLabel('Band name').fill(name)
  await page.getByLabel("First member's email").fill(email)
  await page.getByRole('button', { name: 'Add band' }).click()
  const row = page.getByRole('listitem').filter({ hasText: name })
  await expect(row).toContainText(email)

  // The invite links to the sign-in page; the new member signs in and lands in the band.
  const member = await (await browser.newContext()).newPage()
  await member.goto(await lastLinkFor(email))
  await expect(member).toHaveURL(/\/login$/)
  await signIn(member, email)
  await expect(member.getByRole('main').getByText(name)).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deleted bands' })).toBeVisible()

  page.once('dialog', (d) => d.accept(name))
  await row.getByRole('button', { name: 'Delete permanently' }).click()
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
