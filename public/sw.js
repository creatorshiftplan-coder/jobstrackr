const CACHE_NAME = 'jobstrackr-pwa-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
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

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // Never intercept cross-origin requests. The browser handles them natively
  // under the document's CSP (which whitelists e.g. huggingface.co / jsdelivr for
  // the WASM embedding model). If the SW re-issued these with its own fetch(),
  // the request would be evaluated against the SW's stale CSP context and could
  // be refused, turning the FetchEvent into a hard network error. Letting them
  // pass through also avoids caching opaque third-party responses.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Stale-While-Revalidate for API cache endpoints: serve cached data instantly,
  // refresh in the background so the next open sees fresh data.
  if (
    requestUrl.origin === self.location.origin &&
    (
      event.request.url.includes('/api/cache/homepage') ||
      event.request.url.includes('/api/cache/jobs') ||
      event.request.url.includes('/api/cache/trending-exams') ||
      event.request.url.includes('/api/cache/exam-updates')
    )
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          const networkPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
          return cachedResponse || networkPromise;
        })
      )
    );
    return;
  }

  // HTML Page Navigation - Network first, fallback to cached index.html shell, then offline.html.
  // The fresh shell is written back into the cache on every successful navigation; otherwise the
  // install-time copy goes stale and offline fallbacks reference hashed chunks purged from the
  // server, trapping users on the chunk-error ("App Updated!") screen.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/index.html').then((indexResponse) => {
              if (indexResponse) return indexResponse;
              return caches.match('/offline.html');
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

// Push Notification Event Listener (Architecture Foundation)
self.addEventListener('push', (event) => {
  let data = {
    title: 'JobsTrackr Alert',
    body: 'New government job notification or exam update available!',
    icon: '/icon-192x192.png',
    badge: '/favicon-96x96.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/favicon-96x96.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event Listener (Architecture Foundation)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate to target URL
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new tab/window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
