import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { asMember, asReader } from './helpers'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function newEvent(page: Page, title: string) {
  await page.goto('/demo-band/events/new')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Date').fill(inDays(40))
  await page.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
}

async function addSong(page: Page, set: string, title: string) {
  const input = page.getByLabel(`Add song to ${set}`)
  await input.fill(title)
  await input.press('Enter')
}

const songsIn = (page: Page, nth: number) => page.locator('section.set').nth(nth).locator('ol.song-list .title')

test.describe('member', () => {
  test.use(asMember)

  test('builds a setlist with sets, reordering and a block; copies it to another event', async ({ page }) => {
    const ts = Date.now()

    // A block to reuse.
    await page.goto('/demo-band/blocks')
    await page.getByLabel('New block name').fill(`Encore ${ts}`)
    await page.getByRole('button', { name: 'Create block' }).click()
    const block = page.locator('ul.records li', { hasText: `Encore ${ts}` })
    await block.locator('summary').click()
    await addSong(page, `Encore ${ts}`, 'Closer')
    await block.getByRole('button', { name: 'Save' }).click()
    await expect(block.getByRole('status')).toHaveText('Saved')

    // Build the setlist.
    await newEvent(page, `Setlist Show ${ts}`)
    await page.getByRole('link', { name: 'Build setlist' }).click()
    await page.getByRole('button', { name: 'Start an empty setlist' }).click()
    await addSong(page, 'Set 1', 'Opening Song')
    await addSong(page, 'Set 1', 'Slow One')
    await page.getByRole('button', { name: 'Move Slow One up' }).click()
    await expect(songsIn(page, 0)).toHaveText(['Slow One', 'Opening Song'])

    await page.getByRole('button', { name: 'Add set' }).click()
    await page.getByLabel('Block to add to Set 2').selectOption({ label: `Encore ${ts} (1)` })
    await page.locator('section.set').nth(1).getByRole('button', { name: 'Add block' }).click()
    await expect(songsIn(page, 1)).toHaveText(['Closer'])
    await expect(page.getByRole('status')).toHaveText('Saved')
    await expect(page.locator('.setlist-meta')).toContainText('3 songs · 12:50')

    // Saved: survives a reload, and the event page sums it up.
    await page.reload()
    await expect(songsIn(page, 0)).toHaveText(['Slow One', 'Opening Song'])
    await expect(songsIn(page, 1)).toHaveText(['Closer'])
    await page.getByRole('link', { name: `← Setlist Show ${ts}` }).click()
    await expect(page.locator('.fields')).toContainText('3 songs · 12:50')

    // Copy to another event.
    await newEvent(page, `Copy Show ${ts}`)
    await page.getByRole('link', { name: 'Build setlist' }).click()
    const source = page.getByLabel('Copy setlist from')
    await source.selectOption((await source.locator('option', { hasText: `Setlist Show ${ts}` }).getAttribute('value'))!)
    await page.getByRole('button', { name: 'Copy that setlist' }).click()
    await expect(songsIn(page, 0)).toHaveText(['Slow One', 'Opening Song'])
    await expect(songsIn(page, 1)).toHaveText(['Closer'])
  })
})

test.describe('reader', () => {
  test.use(asReader)

  test('sees a setlist without edit controls', async ({ page }) => {
    await page.goto('/demo-band/events/summer-party/setlist')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Setlist')
    await expect(page.getByRole('button', { name: 'Start an empty setlist' })).toHaveCount(0)
    await expect(page.getByLabel(/Add song to/)).toHaveCount(0)
  })
})
