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

/** "Choose setlist" on the event page → New. Without templates it's a plain link. */
async function chooseNew(page: Page) {
  await page.getByText('Choose setlist').click()
  const item = page.getByRole('menuitem', { name: 'New' })
  const heading = page.getByRole('heading', { level: 1, name: 'Setlist' })
  await expect(item.or(heading)).toBeVisible()
  if (await item.isVisible()) await item.click()
  await expect(heading).toBeVisible()
}

const songsIn = (page: Page, nth: number) => page.locator('section.set').nth(nth).locator('ol.song-list .title a')

test.describe('member', () => {
  test.use(asMember)

  test('builds a setlist with sets, reordering and a block; copies it to another event', async ({ page }) => {
    const ts = Date.now()

    // A block to reuse.
    await page.goto('/demo-band/setlists')
    await page.getByRole('button', { name: 'Create block' }).click()
    const block = page.locator('ul.records li', { has: page.locator('details[open]') })
    await expect(block.getByLabel('Name')).toBeFocused()
    await page.keyboard.type(`Encore ${ts}`) // the placeholder name is selected, so typing replaces it
    await addSong(page, `Encore ${ts}`, 'Closer')
    await block.getByRole('button', { name: 'Save' }).click()
    await expect(block.getByRole('button', { name: 'Saved' })).toBeVisible()

    // Build the setlist.
    await newEvent(page, `Setlist Show ${ts}`)
    await chooseNew(page) // opens in edit mode, on an empty Set 1
    await addSong(page, 'Set 1', 'Opening Song')
    await addSong(page, 'Set 1', 'Slow One')
    await page.getByRole('button', { name: 'Move Slow One up' }).press('Enter') // keyboard-only: shown on focus
    await expect(songsIn(page, 0)).toHaveText(['Slow One', 'Opening Song'])

    await page.getByRole('button', { name: 'Add set' }).click()
    await addSong(page, 'Set 2', `Encore ${ts}`)
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
    await page.getByRole('button', { name: 'Download' }).click()
    await page.getByRole('menuitem', { name: 'Show mode', exact: true }).click()
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

    // Lyrics show mode: one song per screen, straight across sets; no lyrics = just the title.
    await page.getByRole('button', { name: 'Download' }).click()
    await page.getByRole('menuitem', { name: 'Show mode (lyrics)' }).click()
    const song = (name: string) => page.getByRole('article', { name })
    await expect(song('Slow One')).toBeInViewport()
    await expect(song('Slow One')).toContainText('Set 1 · 1/2')
    await expect(song('Slow One')).toContainText('Next: Opening Song')
    await page.getByRole('button', { name: 'Next song' }).click()
    await expect(song('Opening Song')).toBeInViewport()
    await page.keyboard.press('ArrowRight')
    await expect(song('Closer')).toBeInViewport()
    await expect(song('Closer')).toContainText('Set 2 · 1/1')
    await expect(song('Closer')).toContainText('End of setlist')
    await page.getByRole('link', { name: 'Close show mode' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Setlist')

    // Excel: a CSV built in the browser.
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download' }).click()
    await page.getByRole('menuitem', { name: 'Excel' }).click()
    expect((await download).suggestedFilename()).toMatch(/show-.*\.csv$/)
    await expect(page.getByRole('menu')).toHaveCount(0)

    // Print (stage-floor PDF): one page per set.
    await page.getByRole('button', { name: 'Download' }).click()
    await page.getByRole('menuitem', { name: 'Print' }).click()
    await expect(page.locator('.stage-page').first()).toContainText('Slow One')
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1')
    expect(pdf.match(/\/Type\s*\/Page\b(?!s)/g)).toHaveLength(2)

    // Tapping a match adds it right away; an unknown title is offered as a new song.
    await page.getByRole('link', { name: '← Setlist' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Add song to Set 2').fill('Neon')
    await page.getByRole('option', { name: /Neon Harbour/ }).click()
    await expect(songsIn(page, 1)).toHaveText(['Closer', 'Neon Harbour'])
    await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0) // not while editing
    await expect(page.getByRole('option', { name: `Add “Brand new ${ts}” as a new song` })).toHaveCount(0)
    await addSong(page, 'Set 2', `Brand new ${ts}`) // only match is "add as new", so Enter creates it
    await expect(songsIn(page, 1)).toHaveText(['Closer', 'Neon Harbour', `Brand new ${ts}`])
  })
})

test.describe('drag and drop', () => {
  test.use(asMember)

  /** Mouse drag by the grip handle to (x, y); waits for the drop indicator before letting go. */
  async function drag(page: Page, title: string, to: { x: number; y: number }, remove = false) {
    const row = page.locator('ol.song-list li', { hasText: title })
    await row.locator('.drag-handle').hover()
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await expect(page.locator(remove ? '.drag-ghost.drag-remove' : '.drag-line')).toBeVisible()
    await page.mouse.up()
  }

  test('moves a song between sets and removes one dragged out', async ({ page }) => {
    await newEvent(page, `Drag ${Date.now()}`)
    await chooseNew(page)
    await addSong(page, 'Set 1', 'Opening Song')
    await addSong(page, 'Set 1', 'Slow One')
    await page.getByRole('button', { name: 'Add set' }).click()
    await addSong(page, 'Set 2', 'Closer')
    await expect(songsIn(page, 1)).toHaveText(['Closer'])

    // Closer to the top of Set 1; Set 2 is left empty, so it goes.
    const first = (await songsIn(page, 0).first().boundingBox())!
    await drag(page, 'Closer', { x: first.x + 10, y: first.y + 2 })
    await expect(songsIn(page, 0)).toHaveText(['Closer', 'Opening Song', 'Slow One'])
    await expect(page.locator('section.set')).toHaveCount(1)

    // Out to the screen's edge: removed.
    await drag(page, 'Slow One', { x: 5, y: first.y }, true)
    await expect(songsIn(page, 0)).toHaveText(['Closer', 'Opening Song'])
    await expect(page.getByRole('status')).toHaveText('Saved')
    await page.reload()
    await expect(songsIn(page, 0)).toHaveText(['Closer', 'Opening Song'])
  })
})

test.describe('standalone setlists', () => {
  test.use(asMember)

  test('builds a setlist outside an event and starts a new event from it', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/demo-band')
    await page.getByRole('link', { name: 'Setlists' }).click()
    await page.getByRole('button', { name: 'Create setlist' }).click()
    await expect(page.getByLabel('Setlist name')).toBeFocused()
    await page.keyboard.type(`Festival ${ts}`)
    await addSong(page, 'Set 1', 'Neon Harbour')
    await addSong(page, 'Set 1', 'Closer')
    await expect(page.getByRole('status')).toHaveText('Saved')
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Festival ${ts}`)
    await expect(page.getByLabel(/Add song to/)).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible() // a filled setlist opens to view

    // Show mode and stage-floor PDF, like an event's setlist.
    await page.getByRole('button', { name: 'Download' }).click()
    await page.getByRole('menuitem', { name: 'Show mode', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Set 1' })).toContainText('Neon Harbour')
    await page.getByRole('link', { name: 'Close show mode' }).click()
    await page.getByRole('button', { name: 'Download' }).click()
    await page.getByRole('menuitem', { name: 'Print' }).click()
    await expect(page.locator('.stage-page').first()).toContainText(`Set 1 · Festival ${ts}`)
    await page.getByRole('link', { name: '← Setlist' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Festival ${ts}`)

    // An event picks it from "Choose setlist" and uses it as the standard: read-only, customizing clones it.
    await newEvent(page, `Standard ${ts}`)
    await page.getByRole('button', { name: 'Choose setlist' }).click()
    await page.getByRole('menuitem', { name: `Festival ${ts}` }).click()
    await expect(page.getByRole('link', { name: new RegExp(`Festival ${ts} · 2 songs`) })).toBeVisible()
    await page.getByRole('link', { name: /2 songs/ }).click()
    await expect(page.getByLabel('Standard setlist', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Standard setlist', { exact: true })).toHaveValue(/.+/)
    await expect(songsIn(page, 0)).toHaveText(['Neon Harbour', 'Closer'])
    await expect(page.getByRole('button', { name: 'Add set' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Customize' }).click()
    await expect(page.getByRole('button', { name: 'Add set' })).toBeVisible()
    await expect(songsIn(page, 0)).toHaveText(['Neon Harbour', 'Closer'])

    // Back to the standard throws the custom setlist away: asks first.
    await page.getByLabel('Standard setlist', { exact: true }).selectOption({ label: `Festival ${ts}` })
    await expect(page.getByRole('dialog')).toContainText('Use the standard setlist?')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByLabel('Standard setlist', { exact: true })).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Add set' })).toBeVisible()
    await page.getByLabel('Standard setlist', { exact: true }).selectOption({ label: `Festival ${ts}` })
    await page.getByRole('button', { name: 'Use standard' }).click()
    await expect(page.getByRole('button', { name: 'Add set' })).toHaveCount(0)
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
    await expect(page.getByLabel(/Add song to/)).toHaveCount(0)
  })
})
