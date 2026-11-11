import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

test.describe('reader', () => {
  test.use(asReader)

  test('opens the manual from the account menu', async ({ page }) => {
    await page.goto('/demo-band')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'Manual' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Manual')
  })
})
