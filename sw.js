// Galaxia Service Worker (base-safe for GitHub Pages and localhost).
// Keep the app shell small; let Vite-built hashed assets cache at runtime.

const VERSION = 'v3';
const CACHE_NAME = `galaxia-cache-${VERSION}`;

// Determine base path from registration scope so the same file works at
//   - localhost ("/")
//   - GitHub Pages project site ("/Galaxia/")
const BASE = (() => {
  try {
    return new URL(self.registration.scope).pathname || '/';
  } catch {
    return '/';
  }
})();

// Small, stable app-shell. Do NOT hard-code Vite hashed assets here.
const urlsToCache = [
  BASE,                   // e.g., "/" or "/Galaxia/"
  BASE + 'index.html',
  BASE + 'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@200..900&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (keep.includes(n) ? undefined : caches.delete(n))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET over http(s)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;

      // Fetch from network; cache a clone of successful responses
      return fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque' || res.type === 'basic')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigations
        if (req.mode === 'navigate') {
          return caches.match(BASE + 'index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
