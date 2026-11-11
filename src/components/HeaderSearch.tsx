import { useCanGoBack, useMatchRoute, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

/** Always-visible search box. Typing opens /$band/search and keeps its ?q= in step. */
export function HeaderSearch({ band }: { band: string }) {
  const navigate = useNavigate()
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
    <form role="search" className="header-search" onSubmit={(e) => e.preventDefault()}>
      <input
        type="search"
        aria-label="Search"
        placeholder="Search songs, events…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  )
}
