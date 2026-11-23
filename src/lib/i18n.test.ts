import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emailLocale, pickLocale, requestLocale } from './i18n'

describe('pickLocale', () => {
  it('takes the first supported language by preference', () => {
    expect(pickLocale('nl-NL,nl;q=0.9,en-US;q=0.8')).toBe('nl')
    expect(pickLocale('de-DE,en;q=0.5,nl;q=0.7')).toBe('nl')
    expect(pickLocale('en-GB')).toBe('en')
    expect(pickLocale('fr')).toBe('en')
    expect(pickLocale(undefined)).toBe('en')
  })
})

describe('emailLocale', () => {
  const nlBrowser = new Headers({ 'accept-language': 'nl-NL' })
  it('prefers the recipient, then the inviter, then the site (cookie over browser), then English', () => {
    expect(emailLocale({ recipient: 'nl', inviter: 'en', headers: new Headers() })).toBe('nl')
    expect(emailLocale({ recipient: undefined, inviter: 'nl' })).toBe('nl')
    expect(emailLocale({ recipient: 'xx', headers: nlBrowser })).toBe('nl')
    expect(requestLocale(new Headers({ cookie: 'a=1; locale=en', 'accept-language': 'nl' }))).toBe('en')
    expect(emailLocale({})).toBe('en')
  })
})

// Every word on screen comes from the dictionaries, so new screens can't slip through in one language.
// ponytail: a regex, not a parser; it catches JSX text and the usual text attributes, which is where English hides.
describe('no hard-coded UI text', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === 'ui' ? [] : files(join(dir, e.name))) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
    )
  const sameInEveryLanguage = ['Gigg', 'Am']
  // The manual and the privacy page are prose per language, side by side in one file.
  const checked = [...files('src/routes'), ...files('src/components')].filter((f) => !/(manual|privacy)\.tsx$/.test(f))

  it.each(checked)('%s', (file) => {
    const src = readFileSync(file, 'utf8')
    // Text between a tag's `>` (not an arrow's) and the next `<`, minus code that happens to sit there.
    const text = [...src.matchAll(/(?<![=-])>\s*([^<>{}`]*[A-Za-z]{2}[^<>{}`]*?)\s*</g)]
      .map((m) => m[1])
      .filter((s) => !/[=;()]|&&|\b(case|return)\b/.test(s))
    const attrs = [...src.matchAll(/\b(?:aria-label|placeholder|title|label|submitLabel|alt)="([^"]*[A-Za-z][^"]*)"/g)]
      .map((m) => m[1])
      .filter((s) => !sameInEveryLanguage.includes(s))
    expect([...text, ...attrs]).toEqual([])
  })
})
