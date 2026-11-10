import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** The most recent sign-in link mailed to `email` (local mode writes mails to .outbox.jsonl). */
export async function lastLinkFor(email: string) {
  const mails = (await readFile('.outbox.jsonl', 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { to: string; text: string })
    .filter((m) => m.to === email)
  return mails.at(-1)!.text.match(/https?:\/\/\S+/)![0]
}

/** Sign in with an email link. Seeded users: member@example.com, reader@example.com. */
export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText('Check your email')
  await page.goto(await lastLinkFor(email))
}

/** Saved sessions from auth.setup.ts. */
export const asMember = { storageState: 'e2e/.auth/member.json' }
export const asReader = { storageState: 'e2e/.auth/reader.json' }
