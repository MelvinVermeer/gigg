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

  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByRole('status')).toHaveText('Passkey added')

  // Log out via the user menu: back home, menu replaced by "Sign in".
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: /Account menu/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page).toHaveURL(/\/demo-band\/events$/)
  await expect(page.getByRole('button', { name: 'Account menu for member@example.com' })).toHaveText('M')

  // The passkey is listed in settings and can be deleted.
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('link', { name: 'Settings' }).click()
  const list = page.getByRole('list', { name: 'Your passkeys' })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list.getByRole('listitem')).toContainText(/Chrome on \w+, added/)
  page.once('dialog', (d) => d.accept())
  await list.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('status')).toHaveText('Passkey deleted')
  await expect(list).toHaveCount(0)
})
