import { expect, test } from '@playwright/test'
import { asMember, asReader } from './helpers'

test.describe('member', () => {
  test.use(asMember)

  test('edits a venue from settings; the event shows the change', async ({ page }) => {
    const address = `Harbour Road ${Date.now()}`
    await page.goto('/demo-band')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('link', { name: 'Venues' }).click()

    // Only the address: other tests rely on the venue's name.
    const row = page.locator('ul.records li', { hasText: 'The Local Hall' })
    await expect(row).toContainText(/used in \d+ events/)
    await row.locator('summary').click()
    await row.getByLabel('Address').fill(address)
    await row.getByRole('button', { name: 'Save' }).click()
    await expect(row.locator('summary')).toContainText(address)

    await page.goto('/demo-band/events/summer-party')
    await expect(page.locator('.fields')).toContainText(address)
  })
})

test.describe('theme', () => {
  test.use(asReader)

  test('a picked theme sticks after a reload; System follows the OS again', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/demo-band/settings')
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(await bg()).toBe('rgb(255, 255, 255)')

    await page.getByLabel('Dark').check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await bg()).toBe('rgb(17, 17, 17)')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByLabel('Dark')).toBeChecked()
    await expect(page.getByRole('img', { name: 'Gigg' })).not.toHaveAttribute('src', /lockup-ink/) // yellow wordmark

    await page.getByLabel('System').check()
    expect(await bg()).toBe('rgb(255, 255, 255)')
  })
})

test.describe('reader', () => {
  test.use(asReader)

  test('sees personal settings only, and cannot edit venues', async ({ page }) => {
    await page.goto('/demo-band/settings')
    await expect(page.getByRole('heading', { name: 'You' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Venues' })).toHaveCount(0)

    await page.goto('/demo-band/settings/venues')
    await page.locator('ul.records summary').first().click()
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  })
})
