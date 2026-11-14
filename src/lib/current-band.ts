// The last-opened band, per device, in a cookie (like the theme). Set by every /<band> page.

export function rememberBand(slug: string) {
  document.cookie = `band=${slug}; path=/; max-age=31536000; samesite=lax`
}

/** The cookie's band if you're still a member, else your first band, else none. Pass `document.cookie`. */
export function currentBand<B extends { slug: string }>(bands: B[], cookie: string): B | undefined {
  const slug = /(?:^|; )band=([^;]*)/.exec(cookie)?.[1]
  return bands.find((b) => b.slug === slug) ?? bands[0]
}
