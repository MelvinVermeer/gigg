import { useCanGoBack, useMatchRoute, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import { useT } from '#/lib/i18n'

/** Always-visible search box. Typing opens /$band/search and keeps its ?q= in step. */
export function HeaderSearch({ band }: { band: string }) {
  const navigate = useNavigate()
  const t = useT()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const onSearchPage = !!useMatchRoute()({ to: '/$band/search' })
  const q = (useSearch({ strict: false }) as { q?: string }).q ?? ''
  const [text, setText] = useState(onSearchPage ? q : '')
  const input = useRef<HTMLInputElement>(null)
  // Known only after mount, so server and client render the same markup.
  const [mac, setMac] = useState<boolean>()

  // ⌘K / Ctrl+K from anywhere, or / outside a text field, focuses the box. Not in the show overlay, which covers it.
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
    setMac(isMac)
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const combo = e.key.toLowerCase() === 'k' && (isMac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey
      const slash =
        e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !el.isContentEditable && !el.closest('input, textarea, select')
      if (!(combo || slash) || document.querySelector('.show')) return
      e.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Entering the results page (e.g. Back) shows its query; leaving it clears the box.
  useEffect(() => setText(onSearchPage ? q : ''), [onSearchPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Search as you type: push the first navigation (so Back leaves the results), replace after that.
  // Clearing the box goes back to the page you searched from (or the band's home on a direct visit).
  useEffect(() => {
    const t = text.trim()
    if (onSearchPage ? t === q : !t) return
    const id = setTimeout(() => {
      if (t) navigate({ to: '/$band/search', params: { band }, search: { q: t }, replace: onSearchPage })
      else if (canGoBack) router.history.back()
      else navigate({ to: '/$band', params: { band }, replace: true })
    }, 200)
    return () => clearTimeout(id)
  }, [text, q, onSearchPage, band, navigate, router, canGoBack])

  return (
    <form role="search" className="relative w-full max-w-xs" onSubmit={(e) => e.preventDefault()}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={input}
        className="peer pl-8"
        type="search"
        aria-label={t.header.search}
        aria-keyshortcuts={mac === undefined ? undefined : `${mac ? 'Meta' : 'Control'}+K /`}
        placeholder={t.header.searchPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Escape just leaves the box; preventDefault stops it from clearing the query too.
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
      {mac !== undefined && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-sans text-xs text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:peer-placeholder-shown:peer-not-focus:inline-block"
        >
          {mac ? '⌘K' : 'Ctrl K'}
        </kbd>
      )}
    </form>
  )
}
