import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

/** The most recent sign-in link mailed to `email` (local mode writes mails to .outbox.jsonl). */
async function lastLinkFor(email: string) {
  const mails = (await readFile('.outbox.jsonl', 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { to: string; text: string })
    .filter((m) => m.to === email)
  return mails.at(-1)!.text.match(/https?:\/\/\S+/)![0]
}

test('anonymous visitors are sent to the login page', async ({ page }) => {
  await page.goto('/demo-band')
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

  await page.goto('/login')
  await page.getByLabel('Email').fill('member@example.com')
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText('Check your email')

  await page.goto(await lastLinkFor('member@example.com'))
  await expect(page).toHaveURL(/\/demo-band$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo Band')

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByRole('status')).toHaveText('Passkey added')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page).toHaveURL(/\/demo-band$/)
})
