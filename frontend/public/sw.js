/* global self, caches, Request, URL, Response, AbortController, setTimeout, clearTimeout, fetch */

// Minimal service worker for S_Hospital LAN operation.
// Strategy:
//   - API and Sanctum requests are never intercepted or cached.
//   - navigations -> network with a 2s timeout; fall back to the public shell.
//   - explicit public assets -> CacheFirst.
//   - every other request -> pass through to the browser.

const CACHE_VERSION = 's-hospital-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_PATHS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/maskable-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE_PATHS.map(async (path) => {
          try {
            await cache.add(new Request(path, { credentials: 'same-origin' }));
          } catch {
            // Best-effort precache; ignore failures for protected routes.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isSensitiveRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/sanctum/');
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isSensitiveRequest(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationWithOfflineShell(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

async function navigationWithOfflineShell(request) {
  try {
    return await fetchWithTimeout(request, 2000);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const fallback = await cache.match('/');

    return fallback || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
    fetch(request, { signal: controller.signal, credentials: 'same-origin' })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
