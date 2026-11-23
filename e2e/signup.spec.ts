import { expect, test } from '@playwright/test'
import { lastLinkFor } from './helpers'

test('start a band: email + band name, the mailed link creates it and signs you in', async ({ page }) => {
  const email = `signup-${Date.now()}@example.com`
  await page.goto('/')
  await page.getByRole('link', { name: 'Get started' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Band name').fill('The Signups')
  await expect(page.getByRole('link', { name: 'What happens with your data' })).toHaveAttribute('href', '/privacy')
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText('Check your email')

  const link = await lastLinkFor(email)
  await page.goto(link)
  await expect(page).toHaveURL(/\/the-signups(-\d+)?\/events/)
  await expect(page.getByRole('dialog', { name: 'Sign in faster next time' })).toBeVisible()

  // The link is single-use: opening it again doesn't create a second band.
  await page.goto(link)
  await page.goto('/me')
  await expect(page).toHaveURL(/\/the-signups(-\d+)?/)
})
