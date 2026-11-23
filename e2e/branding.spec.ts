import { expect, test } from '@playwright/test'

test('logo, favicons and manifest icons are served', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('img', { name: 'Gigg', exact: true })).toBeVisible()

  const manifest = await (await request.get('/manifest.webmanifest')).json()
  const paths = ['/favicon.ico', '/icon.svg', '/apple-touch-icon.png', ...manifest.icons.map((i: { src: string }) => i.src)]
  for (const path of paths) expect((await request.get(path)).status(), path).toBe(200)
})

test('pages ask search engines not to index them', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
})
