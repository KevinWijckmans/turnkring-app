const CACHE_NAME = 'jv-beheer-v1';
const urlsToCache = [
  '/turnkring-app/beheer.html',
  '/turnkring-app/manifest.json'
];

// Installatie van de service worker en bestanden cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Verzoeken afhandelen (offline ondersteuning)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});