import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { asMember, asReader } from './helpers'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function startEvent(page: Page, title: string) {
  await page.getByRole('link', { name: 'Add event' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Date').fill(inDays(20))
}

test.describe('member', () => {
  test.use(asMember)

  test('adds an event with a new venue and contact, without leaving the form', async ({ page }) => {
    const title = `Club Night ${Date.now()}`
    await page.goto('/demo-band')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Events')

    await startEvent(page, title)
    await page.getByLabel('Venue').fill(`Club ${title}`)
    await page.getByLabel(/New venue/).fill('Side Street 2')
    await page.getByLabel('Add contact').fill('Sam Sound')
    await page.getByLabel('Add contact').press('Enter')
    await page.getByLabel('Phone for Sam Sound').fill('+31 6 1111 2222')
    await page.getByLabel('Add contact').fill('pat')
    await page.getByRole('option', { name: 'Pat Promoter' }).click()
    await page.getByLabel('Booking').selectOption('confirmed')
    await page.getByLabel('Payment').selectOption('free')
    await page.getByLabel('Fee').fill('dinner + drinks')
    await page.getByRole('button', { name: 'Add event' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    const fields = page.locator('.fields')
    await expect(fields).toContainText(`Club ${title}`)
    await expect(fields).toContainText('Side Street 2')
    await expect(fields).toContainText('Confirmed')
    await expect(fields).toContainText('Pat Promoter')
    await expect(fields).toContainText('Free')
    await expect(fields).toContainText('dinner + drinks')
    // Empty fields are left out.
    await expect(fields.getByText('Tags', { exact: true })).toHaveCount(0)
    // Tapping a contact's name opens their details: call, WhatsApp, mail.
    await fields.getByRole('button', { name: 'Sam Sound' }).click()
    const dialog = page.getByRole('dialog', { name: 'Sam Sound' })
    await expect(dialog).toContainText('+31 6 1111 2222')
    await expect(dialog.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+31611112222')
    await expect(dialog.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/31611112222')
    await expect(dialog.getByRole('link', { name: 'Mail' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await fields.getByRole('button', { name: 'Pat Promoter' }).click()
    const pat = page.getByRole('dialog', { name: 'Pat Promoter' })
    await expect(pat).toContainText('+31 6 12345678')
    await expect(pat).toContainText('pat@example.com')
    await expect(pat.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+31612345678')
    await expect(pat.getByRole('link', { name: 'Mail' })).toHaveAttribute('href', 'mailto:pat@example.com')
  })

  test('picking a known venue suggests the contacts from last time', async ({ page }) => {
    const title = `Return Show ${Date.now()}`
    await page.goto('/demo-band/events')
    await startEvent(page, title)

    await page.getByLabel('Venue').fill('The Local Hall')
    await expect(page.locator('.suggestion')).toContainText('Last time at The Local Hall: Pat Promoter')
    await page.locator('.suggestion').getByRole('button', { name: 'Add' }).click()
    await expect(page.getByRole('button', { name: 'Remove Pat Promoter' })).toBeVisible()
    await expect(page.locator('.suggestion')).toHaveCount(0)
    await page.getByRole('button', { name: 'Add event' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.locator('.fields')).toContainText('The Local Hall')
    await expect(page.locator('.fields')).toContainText('Pat Promoter')
  })
})

test.describe('contacts list', () => {
  test.use(asReader)

  test('tapping a phone number opens call / WhatsApp', async ({ page }) => {
    await page.goto('/demo-band/settings/contacts')
    const row = page.locator('ul.records li', { hasText: 'Pat Promoter' })
    await row.getByRole('button', { name: '+31 6 12345678' }).click()
    await expect(page.getByRole('dialog', { name: 'Pat Promoter' }).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/31612345678')
  })
})

test.describe('contact page', () => {
  test.use(asMember)

  test('opens from the event, lists its events, and edits', async ({ page }) => {
    const organisation = `Promo Co ${Date.now()}`
    await page.goto('/demo-band/events/summer-party')
    await page.locator('.fields').getByRole('button', { name: 'Pat Promoter' }).click()
    await page.getByRole('dialog', { name: 'Pat Promoter' }).getByRole('link', { name: 'View contact' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pat Promoter')
    await expect(page.locator('.linked-events').getByRole('link', { name: 'Summer Party' })).toBeVisible()

    // Only the organisation: other tests rely on the name, phone and email.
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByLabel('Organisation').fill(organisation)
    // Save sits in the header (and below the form); history below the rule.
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pat Promoter')
    await expect(page.locator('.fields')).toContainText(organisation)
  })
})

test.describe('reader', () => {
  test.use(asReader)

  test('sees only their own events by default; the filter shows everyone and the past', async ({ page }) => {
    await page.goto('/demo-band')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Events')
    await expect(page.getByRole('link', { name: 'Summer Party' })).toHaveCount(0) // the reader isn't on its list
    await expect(page.getByRole('link', { name: 'Add event' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('menuitemradio', { name: 'Everyone' }).click()
    await expect(page.getByRole('link', { name: 'Summer Party' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Spring Show' })).toHaveCount(0)

    await page.getByRole('menuitemradio', { name: 'Past' }).click()
    await expect(page.getByRole('link', { name: 'Spring Show' })).toBeVisible()
    await expect(page).toHaveURL(/when=past/)
    await expect(page).toHaveURL(/who=all/)
  })
})
