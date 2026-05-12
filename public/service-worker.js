// FLG-Administratie service worker
// Bevat:
//   1. App shell caching (bestaande gedrag)
//   2. Firebase Cloud Messaging background push handler
//   3. Notification click handler dat focus/opens een juiste tab

// ─── Firebase Cloud Messaging (compat SDK for SW context) ───────────────────
// Compat bundel werkt binnen een SW zonder bundling. Versie moet matchen met
// de 'firebase' npm package major (v12.x).
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js');

// Publieke Firebase config — mag in SW staan (API key hier is een public
// identifier, geen secret). messagingSenderId is wat FCM nodig heeft.
firebase.initializeApp({
  apiKey: 'AIzaSyBAC-tl3pCXeUwGlw13tW2-vpwgsG9_jiI',
  authDomain: 'alloon.firebaseapp.com',
  projectId: 'alloon',
  storageBucket: 'alloon.firebasestorage.app',
  messagingSenderId: '896567545879',
  appId: '1:896567545879:web:1ebbf02a7a8ac1c7d50c52',
});

const messaging = firebase.messaging();

// Background push handler. Roept showNotification() aan zodat de OS-laag
// de melding toont OOK als de app gesloten is.
messaging.onBackgroundMessage((payload) => {
  const { notification = {}, data = {} } = payload;
  const title = notification.title || data.title || 'FLG-Administratie';
  const body = notification.body || data.body || '';

  self.registration.showNotification(title, {
    body,
    icon: '/Logo-192.png',
    badge: '/Logo-192.png',
    tag: data.tag || 'flg-notification',
    data: {
      url: data.url || '/',
      taskId: data.taskId || null,
      category: data.category || null,
    },
    requireInteraction: false,
  });
});

// Notification click: focus bestaand tab of open nieuw.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Zoek een bestaande tab van deze origin
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            // Navigeer het bestaande tab naar de target URL
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
            return client.focus();
          } catch (_) {
            // Fallback naar openWindow hieronder
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ─── App shell caching (bestaande gedrag) ───────────────────────────────────
const CACHE_NAME = 'flg-admin-v3.1.1.1.1.1.1.1.1.1.1.1.1.1';
const urlsToCache = ['/', '/Logo.png', '/manifest.json', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache geopend:', CACHE_NAME);
      return cache.addAll(urlsToCache);
    })
  );
  // Geen self.skipWaiting() — de app vraagt de gebruiker om te vernieuwen
  // via het swUpdateAvailable event zodat ze de changelog kunnen zien.
});

// Laat de React-app beslissen wanneer de nieuwe SW actief wordt.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Oude cache weg:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Negeer non-GET en cross-origin
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      const fetchRequest = event.request.clone();
      return fetch(fetchRequest).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});
