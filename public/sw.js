const CACHE_NAME = 'jobstrackr-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/logo.png',
  '/favicon.ico',
  '/favicon-96x96.png',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install Event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // cache core assets
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn('[Service Worker] Static assets caching skipped/failed during install:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-while-revalidate for assets, Network-first for routes
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip API requests and external telemetry/Supabase requests
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // HTML Page Navigation - Network first, fall back to offline index
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/').then((response) => {
          return response || new Response('Offline. Please check your internet connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/html' })
          });
        });
      })
    );
    return;
  }

  // Static Assets - Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to update cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { /* ignore background sync errors */ });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache dynamic static assets like icons, styles, etc.
        if (
          networkResponse.status === 200 && 
          (requestUrl.origin === self.location.origin) &&
          (event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ico)$/))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
