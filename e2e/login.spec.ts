import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('anonymous visitors are sent to the login page', async ({ page }) => {
  await page.goto('/demo-band/songs')
  await expect(page).toHaveURL(/\/login$/)
})

test('sign in with an email link, add a passkey, sign back in with it', async ({ page }) => {
  // Chromium's virtual authenticator stands in for Touch ID / Face ID.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })

  await signIn(page, 'member@example.com')
  await expect(page).toHaveURL(/\/demo-band\/events$/)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByRole('status')).toHaveText('Passkey added')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page).toHaveURL(/\/demo-band\/events$/)
})
