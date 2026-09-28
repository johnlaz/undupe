/* Undupe service worker
 * Serves the whole app from cache so it launches instantly and works offline.
 * Strategy: stale-while-revalidate. You always get the cached copy immediately,
 * and a fresh copy is fetched in the background for the next launch.
 *
 * To force everyone onto a new release right away, bump VERSION below.
 * The app will then show a "Reload to update" prompt (it never reloads by itself,
 * because a scan or migration might be running).
 */
const VERSION = 'v1';
const CACHE = 'undupe-' + VERSION;
const SHELL = [
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'favicon-32.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'dm-sans.woff2',
  'playfair-display.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('undupe-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Every page navigation is the single-page app, whatever URL was typed.
  const key = req.mode === 'navigate'
    ? new URL('index.html', self.registration.scope).href
    : req.url;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const refresh = fetch(key)
      .then((res) => { if (res && res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (cached) { event.waitUntil(refresh); return cached; }
    return (await refresh) || Response.error();
  })());
});
