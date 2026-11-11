import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { asMember } from './helpers'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test.use(asMember)

test('asks the reader, who answers from the emailed link without logging in', async ({ page, browser }) => {
  const title = `Availability ${Date.now()}`
  await page.goto('/demo-band/events/new')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Date').fill(inDays(40))
  await page.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)

  // Nobody is preselected; pick just the reader.
  await page.getByRole('button', { name: 'Check availability' }).click()
  await expect(page.getByRole('button', { name: 'Send request' })).toBeDisabled()
  await page.getByLabel(/reader@example.com/).check()
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByText('0 yes, 0 maybe, 0 no, 1 waiting')).toBeVisible()

  const mail = (await readFile('.outbox.jsonl', 'utf8'))
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { to: string; subject: string; text: string })
    .filter((m) => m.to === 'reader@example.com' && m.subject.includes(title))
    .at(-1)!
  const maybeLink = mail.text.match(/Maybe: (\S+)/)![1]

  // A logged-out visitor: opening the link records nothing until they confirm.
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(maybeLink)
  await expect(guest.getByLabel('Maybe')).toBeChecked()
  await page.reload()
  await expect(page.getByText('0 yes, 0 maybe, 0 no, 1 waiting')).toBeVisible()
  await guest.getByLabel('Note (optional)').fill('after 9pm')
  await guest.getByRole('button', { name: 'Confirm' }).click()
  await expect(guest.getByRole('status')).toContainText('Recorded: Maybe')

  await page.reload()
  await expect(page.getByText('0 yes, 1 maybe, 0 no, 0 waiting')).toBeVisible()
  await expect(page.getByText('“after 9pm”')).toBeVisible()

  await page.getByRole('button', { name: 'Close request' }).click()
  await expect(page.getByText(/\(closed\)/)).toBeVisible()
  await guest.reload()
  await expect(guest.getByRole('status')).toContainText('This request is closed')
})
