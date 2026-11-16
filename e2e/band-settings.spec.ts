import { readFileSync } from 'node:fs'
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
    await page.getByRole('button', { name: 'Save' }).first().click()
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

test('a member adds a song field; a reader shows it in their setlist and Excel', async ({ browser }) => {
  const field = `Lead ${Date.now()}`
  const member = await (await browser.newContext(asMember)).newPage()
  await member.goto('/demo-band/settings')
  await member.getByLabel('New song field').fill(field)
  await member.getByRole('button', { name: 'Add field' }).click()
  await expect(member.getByLabel(`Name of ${field}`)).toHaveValue(field)
  await member.getByLabel('New song field').fill(field.toUpperCase())
  await member.getByRole('button', { name: 'Add field' }).click()
  await expect(member.getByRole('alert')).toHaveText('A song field with this name already exists')

  await member.goto('/demo-band/songs/closer/edit')
  await member.getByLabel(field).fill('Anna')
  await member.getByRole('button', { name: 'Save' }).first().click()
  await expect(member.locator('.fields')).toContainText(`${field}Anna`)

  // Hidden for everyone until ticked: the reader ticks it for the page and Excel, and drops the key from the page.
  const reader = await (await browser.newContext(asReader)).newPage()
  await reader.goto('/demo-band/setlists')
  await reader.getByRole('link', { name: 'Short club set' }).click()
  const closer = reader.locator('.song-list li', { hasText: 'Closer' }).first()
  await expect(closer).toContainText('G')
  await expect(closer).not.toContainText('Anna')
  const setlist = reader.url()

  await reader.goto('/demo-band/settings')
  await reader.getByRole('checkbox', { name: `Show ${field} in Page` }).click()
  await reader.getByRole('checkbox', { name: `Show ${field} in Excel` }).click()
  await reader.getByRole('checkbox', { name: 'Show Key in Page' }).click()
  await reader.getByRole('checkbox', { name: 'Show # in Page' }).click()
  await expect(reader.getByRole('checkbox', { name: 'Show Key in Page' })).not.toBeChecked()
  await reader.reload()
  await expect(reader.getByRole('checkbox', { name: `Show ${field} in Page` })).toBeChecked()

  await reader.goto(setlist)
  await expect(closer).toContainText('Anna')
  await expect(closer.locator('.title')).toHaveText('Closer Anna')
  await expect(closer).not.toContainText(/\d+\./) // no 1. 2. in front
  const download = reader.waitForEvent('download')
  await reader.getByRole('button', { name: 'Download' }).click()
  await reader.getByRole('menuitem', { name: 'Excel' }).click()
  const csv = readFileSync(await (await download).path(), 'utf8')
  expect(csv).toContain(`#;Title;Key;BPM;Tuning;Duration;${field}\r\n`)
  expect(csv).toMatch(/;Closer;G;140;;5:00;Anna\r\n/)

  // Settings stay per person: the member still sees the key, not the field.
  await member.goto(setlist)
  await expect(member.locator('.song-list li', { hasText: 'Closer' }).first().locator('.title')).toHaveText('Closer G')
  await expect(member.locator('.song-list li', { hasText: 'Closer' }).first()).toContainText(/\d+\./)
})

test.describe('notifications', () => {
  test.use(asReader)

  test('are off by default; a choice is saved for the account', async ({ page }) => {
    await page.goto('/demo-band/settings')
    const asked = page.getByLabel('When I’m asked for availability')
    await expect(asked).not.toBeChecked()
    await expect(page.getByLabel('When I’m added as a participant')).not.toBeChecked()
    await asked.click()
    // No VAPID keys in local mode, so this browser can't sign up for push.
    await expect(page.getByRole('status').filter({ hasText: 'can’t show notifications' })).toBeVisible()
    await page.reload()
    await expect(asked).toBeChecked()
    await asked.click()
    await page.reload()
    await expect(asked).not.toBeChecked()
  })
})
