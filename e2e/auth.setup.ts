import { expect, test as setup } from '@playwright/test'
import { signIn } from './helpers'

// Sign in once per role and save the session; specs reuse it via test.use(asMember / asReader).
// (Signing in per test races: parallel tests would pick up each other's one-time links.)
for (const role of ['member', 'reader']) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await signIn(page, `${role}@example.com`)
    await expect(page).toHaveURL(/\/demo-band\/events$/)
    await page.context().storageState({ path: `e2e/.auth/${role}.json` })
  })
}
