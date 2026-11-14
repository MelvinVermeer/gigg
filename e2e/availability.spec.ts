import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { asMember } from './helpers'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test.use(asMember)

test('people are added in the form, asked one by one or all at once, and answer from the emailed link', async ({ page, browser }) => {
  const title = `Availability ${Date.now()}`
  await page.goto('/demo-band/events/new')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Date').fill(inDays(40))
  await page.getByRole('checkbox', { name: /Dev Member/ }).check()
  await page.getByRole('checkbox', { name: /Dev Reader/ }).check()
  await page.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)

  // Adding sends nothing: both are on the list, not asked.
  const region = page.getByRole('region', { name: 'Availability' })
  await expect(region.getByText('not asked', { exact: true })).toHaveCount(2)
  await region.getByRole('button', { name: 'Ask Dev Reader' }).click()
  await expect(region.getByText('waiting', { exact: true })).toBeVisible()
  await expect(region.getByText('not asked', { exact: true })).toHaveCount(1)

  const mails = async () =>
    (await readFile('.outbox.jsonl', 'utf8'))
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { to: string; subject: string; text: string })
      .filter((m) => m.to === 'reader@example.com' && m.subject.includes(title))
  const maybeLink = (await mails()).at(-1)!.text.match(/Maybe: (\S+)/)![1]

  // A logged-out visitor: opening the link records nothing until they confirm.
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(maybeLink)
  await expect(guest.getByRole('radio', { name: 'Maybe' })).toBeChecked()
  await page.reload()
  await expect(region.getByText('waiting', { exact: true })).toBeVisible()
  // A note is only asked for with a maybe.
  await guest.getByRole('radio', { name: 'Yes' }).check()
  await expect(guest.getByRole('textbox', { name: 'Why maybe? (optional)' })).toBeHidden()
  await guest.getByRole('radio', { name: 'Maybe' }).check()
  await guest.getByRole('textbox', { name: 'Why maybe? (optional)' }).fill('after 9pm')
  await guest.getByRole('button', { name: 'Confirm' }).click()
  await expect(guest.getByRole('status')).toContainText('Recorded: Maybe')

  await page.reload()
  await expect(region.getByText('“after 9pm”')).toBeVisible()
  // Checking availability asks only who wasn't asked yet: the member, not the reader again.
  await region.getByRole('button', { name: 'Check availability' }).click()
  await expect(region.getByText('waiting', { exact: true })).toBeVisible()
  await expect(region.getByText('not asked', { exact: true })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Check availability' })).toHaveCount(0)
  expect(await mails()).toHaveLength(1)
})
