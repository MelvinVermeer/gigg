import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { asMember } from './helpers'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test.use(asMember)

const mails = async (to: string, title: string) =>
  (await readFile('.outbox.jsonl', 'utf8'))
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { to: string; subject: string; text: string })
    .filter((m) => m.to === to && m.subject.includes(title))

test('participants are picked in a dialog, asked from it, and answer from the emailed link', async ({ page, browser }) => {
  const title = `Availability ${Date.now()}`
  await page.goto('/demo-band/events/new')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Date').fill(inDays(40))
  // The field starts empty: "Select" opens the dialog.
  await page.getByRole('button', { name: 'Select' }).click()
  const dialog = page.getByRole('dialog', { name: 'Participants' })
  await dialog.getByRole('checkbox', { name: /Dev Member/ }).check()
  await dialog.getByRole('checkbox', { name: /Dev Reader/ }).check()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)

  // Adding sends nothing; no availability card until the check starts.
  const region = page.getByRole('region', { name: 'Availability' })
  await expect(page.getByRole('button', { name: /^2 participants/ })).toBeVisible()
  await expect(region).toHaveCount(0)
  await page.getByRole('button', { name: /^2 participants/ }).click()
  await dialog.getByRole('button', { name: 'Ask availability' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /2 participants.*2 waiting/ })).toBeVisible()

  // The card is only for my own answer.
  await region.getByRole('radio', { name: 'Yes' }).click()
  await region.getByRole('button', { name: 'Save' }).click()
  await expect(region.getByText('Yes', { exact: true })).toBeVisible()
  await expect(region.getByText('Dev Reader')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /2 participants.*1 yes, 1 waiting/ })).toBeVisible()

  const maybeLink = (await mails('reader@example.com', title)).at(-1)!.text.match(/Maybe: (\S+)/)![1]
  // A logged-out visitor: opening the link records nothing until they confirm.
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(maybeLink)
  await expect(guest.getByRole('radio', { name: 'Maybe' })).toBeChecked()
  // A note is only asked for with a maybe.
  await guest.getByRole('radio', { name: 'Yes' }).check()
  await expect(guest.getByRole('textbox', { name: 'Why maybe? (optional)' })).toBeHidden()
  await guest.getByRole('radio', { name: 'Maybe' }).check()
  await guest.getByRole('textbox', { name: 'Why maybe? (optional)' }).fill('after 9pm')
  await guest.getByRole('button', { name: 'Confirm' }).click()
  await expect(guest.getByRole('status')).toContainText('Recorded: Maybe')

  await page.reload()
  await expect(page.getByRole('button', { name: /2 participants.*1 yes, 1 maybe/ })).toBeVisible()
  expect(await mails('reader@example.com', title)).toHaveLength(1)
  // The dialog shows the maybe's reason.
  await page.getByRole('button', { name: /^2 participants/ }).click()
  await expect(page.getByRole('dialog', { name: 'Participants' }).getByText('“after 9pm”')).toBeVisible()
  await page.keyboard.press('Escape')

  // Closing the check hides the card and stops the link; reopening brings both back.
  await page.getByRole('button', { name: /^2 participants/ }).click()
  await dialog.getByRole('button', { name: 'Close availability check' }).click()
  await expect(dialog).toContainText('Availability check closed')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(region).toHaveCount(0)
  await guest.reload()
  await expect(guest.getByRole('status')).toContainText('This availability check is closed')
  await expect(guest.getByRole('button', { name: 'Change my answer' })).toHaveCount(0)
  await page.getByRole('button', { name: /^2 participants/ }).click()
  await dialog.getByRole('button', { name: 'Reopen availability check' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(region).toBeVisible()
  await guest.reload()
  await expect(guest.getByRole('button', { name: 'Change my answer' })).toBeVisible()
})

test('the dialog lists participants first, in the order taken when it opened', async ({ page }) => {
  await page.goto('/demo-band/events/new')
  await page.getByRole('button', { name: 'Select' }).click()
  const dialog = page.getByRole('dialog', { name: 'Participants' })
  const rows = dialog.locator('label')
  await expect(rows).toHaveText(['Select all', 'Dev Member', 'Dev Reader'])
  await dialog.getByRole('checkbox', { name: /Dev Reader/ }).check()
  await dialog.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: /^1 participant/ }).click()
  await expect(rows).toHaveText(['Select all', 'Dev Reader', 'Dev Member'])
  // Ticking doesn't move anyone while it's open.
  await dialog.getByRole('checkbox', { name: /Dev Member/ }).check()
  await dialog.getByRole('checkbox', { name: /Dev Reader/ }).uncheck()
  await expect(rows).toHaveText(['Select all', 'Dev Reader', 'Dev Member'])
  await dialog.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: /^1 participant/ }).click()
  await expect(rows).toHaveText(['Select all', 'Dev Member', 'Dev Reader'])
})

test('ask from the new-event form; someone added later is offered a check, someone removed loses their answer', async ({ page }) => {
  const title = `Participants ${Date.now()}`
  await page.goto('/demo-band/events/new')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Date').fill(inDays(41))
  await page.getByRole('button', { name: 'Select' }).click()
  const dialog = page.getByRole('dialog', { name: 'Participants' })
  await dialog.getByRole('checkbox', { name: 'Select all' }).check()
  await expect(dialog.getByRole('checkbox', { name: /Dev Reader/ })).toBeChecked()
  await dialog.getByRole('checkbox', { name: /Dev Reader/ }).uncheck()
  // Saves the event, then asks.
  await dialog.getByRole('button', { name: 'Ask availability' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  await expect(page.getByRole('button', { name: /^1 participant.*1 waiting/ })).toBeVisible()

  await page.getByRole('button', { name: /^1 participant/ }).click()
  await dialog.getByRole('checkbox', { name: /Dev Reader/ }).check()
  await expect(dialog.getByRole('alert')).toContainText('Do you also want to check availability with this person?')
  await dialog.getByRole('button', { name: 'Yes' }).click()
  await expect(dialog.getByRole('alert')).toBeHidden()
  await expect(dialog.getByText('waiting', { exact: true })).toHaveCount(2)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /^2 participants.*2 waiting/ })).toBeVisible()
  expect(await mails('reader@example.com', title)).toHaveLength(1)

  await page.getByRole('button', { name: /^2 participants/ }).click()
  await dialog.getByRole('checkbox', { name: /Dev Reader/ }).uncheck()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /^1 participant.*1 waiting/ })).toBeVisible()
})
