// public/service-worker.js
// Service worker voor FLG-Begroting. Alleen caching van de app-shell — er zijn
// geen push-notificaties, dus geen Firebase Cloud Messaging in deze worker.

const CACHE_NAME = 'flg-begroting-v1';
const TE_CACHEN = ['/', '/index.html', '/manifest.json', '/Logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(TE_CACHEN)));
  // Bewust geen skipWaiting(): de app vraagt de gebruiker eerst om te vernieuwen.
});

// De React-app bepaalt wanneer de nieuwe versie actief wordt.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(namen.filter((naam) => naam !== CACHE_NAME).map((naam) => caches.delete(naam)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((gecachet) => {
      if (gecachet) return gecachet;

      return fetch(event.request).then((antwoord) => {
        if (!antwoord || antwoord.status !== 200 || antwoord.type !== 'basic') {
          return antwoord;
        }

        const kopie = antwoord.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopie));
        return antwoord;
      });
    })
  );
});
