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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upcoming events')

    await startEvent(page, title)
    await page.getByLabel('Venue').fill(`Club ${title}`)
    await page.getByLabel(/New venue/).fill('Side Street 2')
    await page.getByLabel('Add contact').fill('Sam Sound')
    await page.getByLabel('Add contact').press('Enter')
    await page.getByLabel('Phone for Sam Sound').fill('+31 6 1111 2222')
    await page.getByLabel('Booking').selectOption('confirmed')
    await page.getByRole('button', { name: 'Add event' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    const fields = page.locator('.fields')
    await expect(fields).toContainText(`Club ${title}`)
    await expect(fields).toContainText('Side Street 2')
    await expect(fields).toContainText('Confirmed')
    await expect(page.getByRole('link', { name: '+31 6 1111 2222' })).toHaveAttribute('href', 'tel:+31611112222')
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

test.describe('reader', () => {
  test.use(asReader)

  test('sees upcoming events; past events are behind a button', async ({ page }) => {
    await page.goto('/demo-band')
    await expect(page.getByRole('link', { name: 'Summer Party' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Spring Show' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Add event' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Past events' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Past events')
    await expect(page.getByRole('link', { name: 'Spring Show' })).toBeVisible()
  })
})
