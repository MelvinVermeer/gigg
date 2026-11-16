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

// Push notifications (src/server/push.ts sends { title, body, url, tag }). One tag per event, so a newer
// one replaces the older instead of stacking.
self.addEventListener('push', (e) => {
  const { title, body, url, tag } = e.data.json()
  e.waitUntil(
    self.registration.showNotification(title, { body, tag, renotify: true, icon: '/pwa-192.png', badge: '/badge-96.png', data: { url } }),
  )
})

// Open the event: in a Gigg window that's already open if there is one, otherwise a new one.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data.url, location.origin).href
  e.waitUntil(
    (async () => {
      const [win] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (!win) return self.clients.openWindow(url)
      await win.focus()
      return win.navigate(url).catch(() => self.clients.openWindow(url))
    })(),
  )
})
