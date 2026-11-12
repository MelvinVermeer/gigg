import { expect, test } from '@playwright/test'
import { asMember, signIn } from './helpers'

test('signed out, the browser language decides', async ({ browser }) => {
  const page = await (await browser.newContext({ locale: 'nl-NL' })).newPage()
  await page.goto('/login')
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible()
})

// A fresh account, so the shared test users stay in English.
test('a user switches to Dutch in Settings, and back', async ({ browser }) => {
  const member = await (await browser.newContext(asMember)).newPage()
  const email = `taal-${Date.now()}@example.com`
  await member.goto('/demo-band/settings')
  await member.getByLabel('Invite by email').fill(email)
  await member.getByRole('button', { name: 'Invite' }).click()
  await expect(member.getByRole('button', { name: 'Invited' })).toBeVisible()

  const page = await (await browser.newContext()).newPage()
  await signIn(page, email)
  await page.goto('/demo-band/settings')
  await page.getByRole('radio', { name: 'Nederlands' }).click()
  await expect(page.getByRole('heading', { name: 'Instellingen', level: 1 })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')

  await page.goto('/demo-band/events')
  await expect(page.getByRole('heading', { name: 'Optredens', level: 1 })).toBeVisible()

  await page.goto('/demo-band/settings')
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
})
