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
    await page.goto('/demo-band/setlists')
    await page.getByLabel('New block name').fill(`Encore ${ts}`)
    await page.getByRole('button', { name: 'Create block' }).click()
    const block = page.locator('ul.records li', { hasText: `Encore ${ts}` })
    await block.locator('summary').click()
    await addSong(page, `Encore ${ts}`, 'Closer')
    await block.getByRole('button', { name: 'Save' }).click()
    await expect(block.getByRole('button', { name: 'Saved' })).toBeVisible()

    // Build the setlist.
    await newEvent(page, `Setlist Show ${ts}`)
    await page.getByRole('link', { name: 'Build setlist' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByRole('button', { name: 'Start an empty setlist' }).click()
    await addSong(page, 'Set 1', 'Opening Song')
    await addSong(page, 'Set 1', 'Slow One')
    await page.getByRole('button', { name: 'Move Slow One up' }).click()
    await expect(songsIn(page, 0)).toHaveText(['Slow One', 'Opening Song'])

    await page.getByRole('button', { name: 'Add set' }).click()
    await page.getByLabel('Add song to Set 2').fill(`Block: Encore ${ts} (1)`)
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

    // Show mode: one set per screen, next set by button or key.
    await page.getByRole('link', { name: '3 songs · 12:50' }).click()
    await page.getByRole('link', { name: 'Show mode' }).click()
    const set = (name: string) => page.getByRole('article', { name })
    await expect(set('Set 1')).toBeInViewport()
    await expect(set('Set 1').locator('li')).toHaveText(['Slow One Am', 'Opening Song E'])
    await expect(set('Set 1')).toContainText('Next: Set 2')
    await page.getByRole('button', { name: 'Next set' }).click()
    await expect(set('Set 2')).toBeInViewport()
    await expect(set('Set 2')).toContainText('End of setlist')
    await page.keyboard.press('ArrowLeft')
    await expect(set('Set 1')).toBeInViewport()
    await page.getByRole('link', { name: 'Close show mode' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Setlist')

    // Stage-floor PDF: one page per set.
    await page.getByRole('link', { name: 'Stage-floor PDF' }).click()
    await expect(page.locator('.stage-page').first()).toContainText('Slow One')
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1')
    expect(pdf.match(/\/Type\s*\/Page\b(?!s)/g)).toHaveLength(2)
    await page.getByRole('link', { name: '← Setlist' }).click()
    await page.getByRole('link', { name: `← Setlist Show ${ts}` }).click()

    // Copy to another event.
    await newEvent(page, `Copy Show ${ts}`)
    await page.getByRole('link', { name: 'Build setlist' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const source = page.getByLabel('Copy setlist from')
    await source.selectOption((await source.locator('option', { hasText: `Setlist Show ${ts}` }).getAttribute('value'))!)
    await page.getByRole('button', { name: 'Copy that setlist' }).click()
    await expect(songsIn(page, 0)).toHaveText(['Slow One', 'Opening Song'])
    await expect(songsIn(page, 1)).toHaveText(['Closer'])
  })
})

test.describe('standalone setlists', () => {
  test.use(asMember)

  test('builds a setlist outside an event and starts a new event from it', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/demo-band')
    await page.getByRole('link', { name: 'Setlists' }).click()
    await page.getByLabel('New setlist name').fill(`Festival ${ts}`)
    await page.getByRole('button', { name: 'Create setlist' }).click()
    await page.getByRole('button', { name: 'Start an empty setlist' }).click()
    await addSong(page, 'Set 1', 'Neon Harbour')
    await addSong(page, 'Set 1', 'Closer')
    await expect(page.getByRole('status')).toHaveText('Saved')
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Festival ${ts}`)
    await expect(page.getByLabel(/Add song to/)).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible() // a filled setlist opens to view

    await page.goto('/demo-band/events/new')
    await page.getByLabel('Title').fill(`From template ${ts}`)
    await page.getByLabel('Date').fill(inDays(50))
    await page.getByLabel(/^Setlist/).selectOption({ value: (await page.locator('option', { hasText: `Festival ${ts}` }).last().getAttribute('value'))! })
    await page.getByRole('button', { name: 'Add event' }).click()
    await page.getByRole('link', { name: /2 songs/ }).click()
    await expect(songsIn(page, 0)).toHaveText(['Neon Harbour', 'Closer'])

    // A second event uses it as the standard: read-only, and switching to custom clones it.
    await page.goto('/demo-band/events/new')
    await page.getByLabel('Title').fill(`Standard ${ts}`)
    await page.getByLabel('Date').fill(inDays(51))
    await page.getByLabel(/^Setlist/).selectOption({ value: (await page.locator('option', { hasText: `Festival ${ts}` }).first().getAttribute('value'))! })
    await page.getByRole('button', { name: 'Add event' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`Festival ${ts} · 2 songs`) })).toBeVisible()
    await page.getByRole('link', { name: /2 songs/ }).click()
    await expect(page.getByLabel('Standard setlist')).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Standard setlist')).toHaveValue(/.+/)
    await expect(songsIn(page, 0)).toHaveText(['Neon Harbour', 'Closer'])
    await expect(page.getByRole('button', { name: 'Add set' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Customize' }).click()
    await expect(page.getByRole('button', { name: 'Add set' })).toBeVisible()
    await expect(songsIn(page, 0)).toHaveText(['Neon Harbour', 'Closer'])
  })

  test('shows an item’s history, with before → after', async ({ page }) => {
    const title = `History me ${Date.now()}`
    await page.goto('/demo-band/songs/new')
    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: /Add song/ }).click()
    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Key').fill('E')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)

    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.getByRole('link', { name: 'History' }).click()
    const entry = page.locator('ul.history > li').first()
    await expect(entry).toContainText(`Changed song “${title}”: key`)
    await expect(entry).toContainText('Dev Member')
    await entry.locator('summary').click()
    await expect(entry.locator('.diff')).toHaveText('–→E')
    await expect(page.locator('ul.history > li')).toHaveCount(2) // added, then changed: nothing from other songs
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
