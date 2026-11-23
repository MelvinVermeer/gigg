import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { asReader, signIn } from './helpers'

test.describe('reader', () => {
  test.use(asReader)

  test('sends feedback', async ({ page }) => {
    await page.goto('/demo-band')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'Feedback' }).click()
    const body = `The setlist is great ${Date.now()}`
    await page.getByLabel('Your feedback').fill(body)
    await page.getByRole('button', { name: 'Send feedback' }).click()
    await expect(page.getByRole('status')).toHaveText('Thanks, we got it.')
    // Not from an admin, so the admin gets it by mail too.
    const mails = (await readFile('.outbox.jsonl', 'utf8')).trim().split('\n').map((l) => JSON.parse(l))
    expect(mails.some((m) => m.to === 'admin@example.com' && m.text.includes(body))).toBe(true)
  })
})

test('admin marks feedback done; it is hidden until "Show all"', async ({ browser, page }) => {
  const body = `Done me ${Date.now()}`
  const reader = await browser.newPage({ storageState: asReader.storageState })
  await reader.goto('/demo-band/feedback')
  await reader.getByLabel('Your feedback').fill(body)
  await reader.getByRole('button', { name: 'Send feedback' }).click()
  await expect(reader.getByRole('status')).toHaveText('Thanks, we got it.')
  await reader.close()

  await signIn(page, 'admin@example.com')
  await page.goto('/admin')
  const item = page.getByRole('listitem').filter({ hasText: body })
  await item.getByRole('checkbox', { name: 'Done' }).click()
  await expect(item).toHaveCount(0)
  await page.getByRole('checkbox', { name: /Show all/ }).click()
  await expect(item.getByRole('checkbox', { name: 'Done' })).toBeChecked()
})
