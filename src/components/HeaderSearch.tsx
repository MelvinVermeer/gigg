import { useCanGoBack, useMatchRoute, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
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
        className="pl-8"
        type="search"
        aria-label={t.header.search}
        placeholder={t.header.searchPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  )
}
