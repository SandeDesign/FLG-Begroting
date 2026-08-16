// public/service-worker.js
// Service worker voor FLG-Begroting. Alleen caching — er zijn geen push-
// notificaties, dus geen Firebase Cloud Messaging in deze worker.
//
// De HTML wordt geserveerd uit de cache én tegelijk op de achtergrond
// ververst. Eerst naar het netwerk gaan betekende namelijk dat je op mobiel bij
// elke keer openen op de verbinding stond te wachten voordat er iets in beeld
// kwam. Nu staat het scherm er meteen en wordt de nieuwe versie klaargezet voor
// de volgende keer — de app vraagt je dan zelf om te vernieuwen.

const CACHE_NAME = 'flg-begroting-v3';
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

  // Navigatie (een pagina openen of verversen): meteen uit de cache, en
  // ondertussen op de achtergrond de nieuwste versie ophalen. Zo hoef je nooit
  // op de verbinding te wachten om iets te zien.
  //
  // Een nieuwe deploy komt daarmee één keer later door. Dat is geen probleem:
  // de browser controleert deze service worker apart, en zodra er een nieuwe
  // versie klaarstaat vraagt de app zelf of je wilt vernieuwen.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(OFFLINE_PAGINA).then((gecachet) => {
          const vanNetwerk = fetch(request)
            .then((antwoord) => {
              if (antwoord && antwoord.status === 200) {
                cache.put(OFFLINE_PAGINA, antwoord.clone());
              }
              return antwoord;
            })
            .catch(() => gecachet || Response.error());

          return gecachet || vanNetwerk;
        })
      )
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
