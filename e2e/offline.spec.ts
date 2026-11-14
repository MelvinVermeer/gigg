import { expect, test } from '@playwright/test'
import { asMember, asReader } from './helpers'

test.use(asReader)

// Uses whichever gig is first in the list: other tests add events, and the events list preloads
// only the first few.
test('visited pages, show mode and preloaded gigs work offline', async ({ page, context }) => {
  await page.goto('/demo-band/events?who=all')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Now controlled by the service worker: this page and the preloaded gigs go into the cache.
  await page.reload()
  await page.waitForLoadState('networkidle')
  const first = page.locator('ul.events li a').first()
  const title = (await first.textContent())!
  const href = (await first.getAttribute('href'))!
  await page.goto(`${href}/show`)
  await expect(page.locator('.show-bar')).toContainText(title)
  await page.goto('/demo-band/events?who=all')
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

test('opening a band preloads setlists, songs and every song for offline', async ({ page, context }) => {
  await page.goto('/demo-band/events')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Now controlled by the service worker: the band preloads setlists, its songs list and every song.
  await page.reload()
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await page.getByRole('link', { name: 'Setlists' }).click()
  await expect(page.getByRole('heading', { name: 'Setlists', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'All songs' }).click()
  await expect(page.getByRole('heading', { name: 'Songs', level: 1 })).toBeVisible()
  const song = page.locator('table.songs tbody a').last()
  const title = (await song.textContent())!
  await song.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
})

test('opening a band preloads the setlists and songs pages for a full load offline', async ({ page, context }) => {
  await page.goto('/demo-band/events')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await page.goto('/demo-band/setlists')
  await expect(page.getByRole('heading', { name: 'Setlists', level: 1 })).toBeVisible()
  await page.goto('/demo-band/songs')
  await expect(page.getByRole('heading', { name: 'Songs', level: 1 })).toBeVisible()
})

test('a songs list opened online reloads offline', async ({ page, context }) => {
  await page.goto('/demo-band/songs')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('table.songs tbody tr').first()).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('status')).toContainText('Offline')
  await expect(page.locator('table.songs tbody tr').first()).toBeVisible()
})

test.describe('as a member', () => {
  test.use(asMember)

  test('offline hides editing, and the events filter keeps working', async ({ page, context }) => {
    await page.goto('/demo-band/events')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // Now controlled by the service worker: this list, the past list and the first gigs go into the cache.
    await page.reload()
    await page.waitForLoadState('networkidle')
    const add = page.getByRole('link', { name: 'Add event' })
    await expect(add).toBeVisible()

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('status')).toContainText('Offline')
    await expect(add).toHaveCount(0)

    // Every filter works from the cached lists.
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('menuitemradio', { name: 'Everyone' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Lead' }).click()
    await page.getByRole('menuitemradio', { name: 'Past' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Events', level: 1 })).toBeVisible()
    await expect(page.locator('ul.events li').first()).toBeVisible()

    await page.goto('/demo-band/events')
    await page.locator('ul.events li a').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  })
})
