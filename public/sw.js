// Service Worker for Vương Quyền • Poker Chess 3D PWA
const CACHE_NAME = 'poker-chess-3d-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  // Pass-through for cross-origin, WebSocket, API, traffic, and Vite dev module calls
  if (
    !url.startsWith(self.location.origin) ||
    url.includes('/api/') ||
    url.includes('/traffic') ||
    url.includes('/src/') ||
    url.includes('/@') ||
    url.includes('/node_modules/') ||
    url.startsWith('ws:') ||
    url.startsWith('wss:')
  ) {
    return;
  }

  // Network-first strategy with safe cache fallback (never resolves to undefined)
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});

