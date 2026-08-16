// public/service-worker.js
// Service worker voor FLG-Begroting. Alleen caching — er zijn geen push-
// notificaties, dus geen Firebase Cloud Messaging in deze worker.
//
// Belangrijk: de HTML wordt NIET cache-first geserveerd. Deed hij dat wel, dan
// bleef een oude versie van de app hangen na een nieuwe deploy en zag je nieuwe
// pagina's niet verschijnen. Navigatie gaat daarom eerst naar het netwerk, met
// de cache alleen als terugval wanneer je offline bent.

const CACHE_NAME = 'flg-begroting-v2';
const OFFLINE_PAGINA = '/index.html';
const TE_CACHEN = ['/', OFFLINE_PAGINA, '/manifest.json', '/Logo.png'];

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
  const request = event.request;

  if (request.method !== 'GET') return;

  // Navigatie (een pagina openen of verversen): altijd eerst het netwerk, zodat
  // een nieuwe deploy meteen doorkomt. Offline val je terug op de cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((antwoord) => {
          const kopie = antwoord.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_PAGINA, kopie));
          return antwoord;
        })
        .catch(() => caches.match(OFFLINE_PAGINA).then((gecachet) => gecachet || Response.error()))
    );
    return;
  }

  // Alles met een hash in de bestandsnaam verandert nooit van inhoud, dus die
  // mag gerust uit de cache komen.
  event.respondWith(
    caches.match(request).then((gecachet) => {
      if (gecachet) return gecachet;

      return fetch(request).then((antwoord) => {
        if (!antwoord || antwoord.status !== 200 || antwoord.type !== 'basic') {
          return antwoord;
        }

        const kopie = antwoord.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, kopie));
        return antwoord;
      });
    })
  );
});
