const CACHE_NAME = 'galaxia-cache-v5-ui-overhaul';
const CACHE_PREFIX = 'galaxia-cache-';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.allSettled(
      CORE_ASSETS.map(async asset => {
        const request = new Request(asset, { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      })
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(request, url)) event.respondWith(cacheFirstStatic(request));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
      || (await cache.match('/index.html'))
      || (await cache.match('/'))
      || new Response('Galaxia is offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function isStaticAsset(request, url) {
  const staticDestinations = new Set([
    'audio',
    'font',
    'image',
    'manifest',
    'script',
    'style',
    'video',
    'worker'
  ]);

  return staticDestinations.has(request.destination)
    || /\.(?:avif|css|gif|ico|jpe?g|js|json|mjs|mp3|ogg|opus|png|svg|webmanifest|webp|woff2?)$/i.test(url.pathname);
}
