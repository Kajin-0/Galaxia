// Galaxia Service Worker - production-safe for GitHub Pages & local dev.
// Caches an app shell and uses cache-first with network fallback for GETs.

const VERSION = 'v3';
const CACHE_NAME = `galaxia-cache-${VERSION}`;

// Compute the base path dynamically from the scope so this works on
// both localhost ("/") and GitHub Pages ("/Galaxia/").
const BASE = (() => {
  try {
    return new URL(self.registration.scope).pathname || '/';
  } catch {
    return '/';
  }
})();

// Keep the app shell small and stable. Hashed Vite assets are fetched
// and cached at runtime; do not hard-code them here.
const urlsToCache = [
  BASE,                    // e.g., "/Galaxia/" or "/"
  BASE + 'index.html',
  BASE + 'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@200..900&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const keep = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(n => (keep.includes(n) ? undefined : caches.delete(n)))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests.
  if (req.method !== 'GET') return;

  // Don’t try to cache non-HTTP(S) schemes.
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;

      // Fetch from network, then cache a clone for future.
      return fetch(req).then(res => {
        // Only cache successful, basic/opaque allowed responses.
        if (
          res &&
          (res.status === 200 || res.type === 'opaque' || res.type === 'basic')
        ) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            // Avoid caching POST/PUT/etc (already filtered), and avoid caching
            // requests that might be short-lived auth tokens (none here).
            cache.put(req, resClone).catch(() => {});
          });
        }
        return res;
      }).catch(() => {
        // Optional: basic offline fallback for HTML navigations.
        if (req.mode === 'navigate') {
          return caches.match(BASE + 'index.html');
        }
        // Otherwise, just let it fail.
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
