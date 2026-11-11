import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

test.describe('reader', () => {
  test.use(asReader)

  test('sends feedback', async ({ page }) => {
    await page.goto('/demo-band')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('link', { name: 'Feedback' }).click()
    await page.getByLabel('Your feedback').fill('The setlist is great')
    await page.getByRole('button', { name: 'Send feedback' }).click()
    await expect(page.getByRole('status')).toHaveText('Thanks, we got it.')
  })
})
