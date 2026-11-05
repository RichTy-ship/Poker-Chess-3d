// Service Worker for Vương Quyền • Poker Chess 3D PWA
const CACHE_NAME = 'poker-chess-3d-v2';

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
  // Pass-through for WebSocket and API calls
  const url = event.request.url;
  if (url.includes('/api/') || url.startsWith('ws:') || url.startsWith('wss:')) {
    return;
  }

  // Stale-while-revalidate or Network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
