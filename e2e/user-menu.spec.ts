import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

// Logging out is covered in login.spec.ts: it would end the shared session these tests use.
test.describe('user menu', () => {
  test.use(asReader)

  test('shows the email, the band and settings', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/demo-band\/events$/) // `/` opens your band
    const avatar = page.getByRole('button', { name: 'Account menu for Dev Reader' })
    await expect(avatar).toHaveText('D')
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0)

    await avatar.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu).toContainText('Dev Reader')
    await expect(menu.getByRole('menuitem', { name: 'Log out' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    await avatar.click()
    await menu.getByRole('menuitem', { name: 'Demo Band' }).click()
    await expect(page).toHaveURL(/\/demo-band\/events$/)
    await expect(menu).toBeHidden()

    await avatar.click()
    await menu.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/demo-band\/settings$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
    await expect(page.getByText('Signed in as reader@example.com')).toBeVisible()
  })
})

test('signed-out visitors see "Sign in" instead of the menu', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Account menu/ })).toHaveCount(0)
})
