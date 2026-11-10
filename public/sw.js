// Offline read-only: every same-origin GET (pages, assets, read operations) is network-first and
// cached; without a network the last cached copy is served. Writes (POST) are never cached, so
// they simply fail offline. Logging out clears the cache (UserMenu).
// ponytail: only what you visited (or the app preloaded) is available offline.
const CACHE = 'gigg'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  e.respondWith(
    fetch(req).then(
      (res) => {
        // Redirected pages would hydrate under the wrong URL, so they are not cached.
        if (res.ok && !res.redirected) {
          const copy = res.clone()
          e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)))
        }
        return res
      },
      async (err) => (await caches.match(req)) ?? Promise.reject(err),
    ),
  )
})
