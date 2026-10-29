/* BanglaRx service worker.
 * It only keeps the app's own files (pages, scripts, styles, icons) so the app opens fast and shows a friendly page when
 * there is no connection. It NEVER keeps anything from /api: patient and clinic data must not sit on the phone.
 * Bump VERSION to force every phone to fetch a fresh copy. */
const VERSION = 'v1';
const SHELL = `banglarx-shell-${VERSION}`;
const ASSETS = `banglarx-assets-${VERSION}`;
const PRECACHE = ['/', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // other sites, and the API, are never touched
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // opening the app: try the network so a new release shows up, fall back to the saved shell, then to the offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // built files have a hash in their name, so a saved copy is always the right one
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
