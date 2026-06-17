self.addEventListener('fetch', function(event) {
  // De AI/Service Worker mag de aanvraag NIET cachen. 
  // Stuur de gebruiker altijd rechtstreeks naar het internet.
  event.respondWith(fetch(event.request));
});
