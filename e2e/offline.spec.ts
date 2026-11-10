import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

test.use(asReader)

test('visited pages, show mode and preloaded gigs work offline', async ({ page, context }) => {
  await page.goto('/demo-band/events')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Now controlled by the service worker: this page and the preloaded gigs go into the cache.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.goto('/demo-band/events/summer-party/show')
  await expect(page.locator('.show-bar')).toContainText('Summer Party')
  await page.goto('/demo-band/events')
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('status')).toContainText('Offline')
  // Never opened, but preloaded from the events list.
  await page.getByRole('link', { name: 'Summer Party' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Summer Party')

  await page.goto('/demo-band/events/summer-party/show')
  await expect(page.locator('.show-bar')).toContainText('Summer Party')
  await page.getByRole('link', { name: 'Close show mode' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Setlist')
})
