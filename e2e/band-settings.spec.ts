import { expect, test } from '@playwright/test'
import { asMember, asReader, signIn } from './helpers'

test.describe('member', () => {
  test.use(asMember)

  test('edits a venue from settings; the event shows the change', async ({ page }) => {
    const address = `Harbour Road ${Date.now()}`
    await page.goto('/demo-band')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await page.getByRole('link', { name: 'Venues' }).click()

    // Only the address: other tests rely on the venue's name.
    const row = page.locator('ul.records li', { hasText: 'The Local Hall' })
    await expect(row).toContainText(/used in \d+ events/)
    await row.getByRole('link', { name: 'The Local Hall' }).click()
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByLabel('Address').fill(address)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Local Hall')
    await expect(page.locator('.fields').getByRole('link', { name: address })).toHaveAttribute('href', /google\.com\/maps/)

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

  // The display name saves on Enter (no Save button); the card keeps showing the email.
  const name = guest.getByLabel('Display name')
  await name.fill('New Reader')
  await name.press('Enter')
  await expect(guest.getByText('Saved')).toBeVisible()
  await guest.reload()
  await expect(name).toHaveValue('New Reader')
  await expect(guest.getByText(`Signed in as ${email}`)).toBeVisible()

  await row.getByRole('button', { name: `Remove ${email}` }).click()
  await member.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
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

    await page.getByRole('radio', { name: 'Dark' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await bg()).toBe('rgb(17, 17, 17)')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked()
    await expect(page.getByRole('img', { name: 'Gigg' })).not.toHaveAttribute('src', /lockup-ink/) // yellow wordmark

    await page.getByRole('radio', { name: 'System' }).check()
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
    await page.locator('ul.records').getByRole('link').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  })

  test('subscribes to the band calendar: the feed has timed gigs, options marked', async ({ page, request }) => {
    await page.goto('/demo-band/settings')
    const link = page.getByRole('textbox', { name: 'Your calendar link' })
    await expect(link).toHaveValue(/\/api\/calendar\/.+\.ics$/)
    await expect(page.getByRole('link', { name: 'Add to Apple Calendar' })).toHaveAttribute('href', /^webcal:/)
    const res = await request.get(await link.inputValue())
    expect(res.headers()['content-type']).toContain('text/calendar')
    const ics = (await res.text()).replace(/\r\n /g, '')
    expect(ics).toContain('SUMMARY:Rusty Anchor Friday')
    expect(ics).toContain('SUMMARY:(option) Park Festival')
    expect(ics).not.toContain('Rained-out Festival')
    expect(ics).toContain('/demo-band/events/rusty-anchor-friday')
  })
})
