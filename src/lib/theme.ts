// Theme preference per device, in a cookie. Absent = follow the system.
export type Theme = 'system' | 'light' | 'dark'

/** Runs in <head> before first paint, so a picked theme never flashes the other one. */
export const themeScript = `document.documentElement.dataset.theme=(document.cookie.match(/(?:^|; )theme=(light|dark)/)||[])[1]||''`

export function currentTheme(): Theme {
  const m = /(?:^|; )theme=(light|dark)/.exec(document.cookie)
  return (m?.[1] as Theme | undefined) ?? 'system'
}

export function setTheme(theme: Theme) {
  document.cookie =
    theme === 'system' ? 'theme=; path=/; max-age=0' : `theme=${theme}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.dataset.theme = theme === 'system' ? '' : theme
}
