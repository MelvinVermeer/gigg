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
  await page.getByLabel(/Dev Reader/).check()
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('region', { name: 'Availability' }).getByText('waiting', { exact: true })).toBeVisible()

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
  await expect(guest.getByRole('radio', { name: 'Maybe' })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Availability' }).getByText('waiting', { exact: true })).toBeVisible()
  // A note is only asked for with a maybe.
  await guest.getByRole('radio', { name: 'Yes' }).check()
  await expect(guest.getByRole('textbox', { name: 'Why maybe? (optional)' })).toBeHidden()
  await guest.getByRole('radio', { name: 'Maybe' }).check()
  await guest.getByRole('textbox', { name: 'Why maybe? (optional)' }).fill('after 9pm')
  await guest.getByRole('button', { name: 'Confirm' }).click()
  // The only person asked answered, so the check closed itself.
  await expect(guest.getByRole('status')).toContainText('This request is closed')

  await page.reload()
  await expect(page.getByRole('region', { name: 'Availability' })).toBeHidden()
  await page.getByRole('button', { name: '1 maybe' }).click()
  const dialog = page.getByRole('dialog', { name: 'Availability' })
  await expect(dialog.getByText('“after 9pm”')).toBeVisible()
  await dialog.getByRole('button', { name: 'New availability check' }).click()
  await dialog.getByLabel(/Dev Reader/).check()
  await dialog.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('region', { name: 'Availability' }).getByText('waiting', { exact: true })).toBeVisible()
})
