import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

test.use(asReader)

// Uses whichever gig is first in the list: other tests add events, and the events list preloads
// only the first few.
test('visited pages, show mode and preloaded gigs work offline', async ({ page, context }) => {
  await page.goto('/demo-band/events')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Now controlled by the service worker: this page and the preloaded gigs go into the cache.
  await page.reload()
  await page.waitForLoadState('networkidle')
  const first = page.locator('ul.events li a').first()
  const title = (await first.textContent())!
  const href = (await first.getAttribute('href'))!
  await page.goto(`${href}/show`)
  await expect(page.locator('.show-bar')).toContainText(title)
  await page.goto('/demo-band/events')
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('status')).toContainText('Offline')
  // The event page itself was never opened, only preloaded.
  await page.locator('ul.events li a').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)

  await page.goto(`${href}/show`)
  await expect(page.locator('.show-bar')).toContainText(title)
  await page.getByRole('link', { name: 'Close show mode' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Setlist')
})
