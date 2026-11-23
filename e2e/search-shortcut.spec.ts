import { expect, test } from '@playwright/test'
import { asReader } from './helpers'

test.use(asReader)

test('⌘K / Ctrl+K and / focus the header search; / typed in a field stays there', async ({ page }) => {
  await page.goto('/demo-band/settings')
  const box = page.getByRole('searchbox')
  const name = page.getByLabel('Display name')
  await expect(box).toHaveAttribute('aria-keyshortcuts', /\+K \/$/)

  // From inside another field, ⌘K / Ctrl+K still jumps to search.
  await name.focus()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(box).toBeFocused()

  // Escape leaves the box without clearing it.
  await box.fill('clo')
  await box.press('Escape')
  await expect(box).not.toBeFocused()
  await expect(box).toHaveValue('clo')
  await box.fill('')

  // / in a text field types a slash.
  await name.focus()
  await page.keyboard.press('/')
  await expect(name).toBeFocused()
  await expect(name).toHaveValue(/\//)
  // Put the name back before leaving the field: it saves on blur when changed, and this is the shared reader.
  await name.fill('Dev Reader')

  // / elsewhere focuses search, without typing the slash.
  await page.getByRole('main').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('/')
  await expect(box).toBeFocused()
  await expect(box).toHaveValue('')
})
