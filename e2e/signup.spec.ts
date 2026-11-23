import { expect, test } from '@playwright/test'
import { lastLinkFor } from './helpers'

test('start a band: email + band name, the mailed link creates it and signs you in', async ({ page }) => {
  const email = `signup-${Date.now()}@example.com`
  await page.goto('/')
  await page.getByRole('link', { name: 'Get started' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Band name').fill('The Signups')
  await expect(page.getByRole('link', { name: 'What happens with your data' })).toHaveAttribute('href', '/privacy')
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText('Check your email')

  const link = await lastLinkFor(email)
  await page.goto(link)
  await expect(page).toHaveURL(/\/the-signups(-\d+)?\/welcome/)
  await expect(page.getByRole('dialog', { name: 'Sign in faster next time' })).toBeVisible()
  await page.getByRole('button', { name: "I'll configure later via settings" }).click()
  const band = new URL(page.url()).pathname.split('/')[1]
  const songsItem = page.getByRole('listitem').filter({ hasText: 'Add your songs' })
  await expect(songsItem).not.toHaveAttribute('data-done')

  // Import a small CSV through the mapping step: the songs item ticks itself.
  await page.goto(`/${band}/settings`)
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByLabel('Or paste here').fill('Song;Duration\nOpener;3:45\nCloser;4:10')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Import 2 rows' }).click()
  await expect(page.getByText('2 created, 0 updated, 0 skipped.')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.goto(`/${band}/welcome`)
  await expect(songsItem).toHaveAttribute('data-done')

  // A personal item ticks on "Got it"; Hide takes the bar off the events page.
  await page.getByRole('listitem').filter({ hasText: 'Your gigs in your own calendar' }).getByRole('button', { name: 'Got it' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Your gigs in your own calendar' })).toHaveAttribute('data-done')
  await page.goto(`/${band}/events`)
  await expect(page.getByRole('link', { name: /Get to know gigg · 2\/\d+/ })).toBeVisible()
  await page.goto(`/${band}/welcome`)
  await page.getByRole('button', { name: 'Hide' }).click()
  await expect(page.getByRole('button', { name: 'Hide' })).toHaveCount(0)
  await page.goto(`/${band}/events`)
  await expect(page.getByRole('link', { name: /Get to know gigg/ })).toHaveCount(0)

  // The link is single-use: opening it again doesn't create a second band.
  await page.goto(link)
  await page.goto('/me')
  await expect(page).toHaveURL(/\/the-signups(-\d+)?/)
})
