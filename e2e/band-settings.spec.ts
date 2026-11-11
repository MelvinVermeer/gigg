import { expect, test } from '@playwright/test'
import { asMember, asReader, signIn } from './helpers'

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

test('a member invites someone, who signs in and sees the band, then is removed', async ({ browser }) => {
  const member = await (await browser.newContext(asMember)).newPage()
  const email = `invited-${Date.now()}@example.com`
  await member.goto('/demo-band/settings')
  await member.getByLabel('Invite by email').fill(email)
  await member.getByLabel('Role').selectOption('reader')
  await member.getByRole('button', { name: 'Invite' }).click()
  const row = member.getByRole('listitem').filter({ hasText: email })
  await expect(row).toContainText('reader')

  const guest = await (await browser.newContext()).newPage()
  await signIn(guest, email)
  await expect(guest.getByRole('main').getByText('Demo Band')).toBeVisible()
  await guest.goto('/demo-band/settings')
  await expect(guest.getByLabel('Invite by email')).toHaveCount(0)

  member.once('dialog', (d) => d.accept())
  await row.getByRole('button', { name: 'Remove' }).click()
  await expect(row).toHaveCount(0)
  expect((await guest.request.get('/demo-band/songs')).status()).toBe(404)
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
