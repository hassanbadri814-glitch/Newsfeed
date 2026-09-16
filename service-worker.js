/* WAR DESK — Self-destruct service worker
   Wist alle oude caches en schrijft zichzelf uit.
   Na deze versie werkt de app zonder service worker. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Verwijder ALLE caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // Schrijf deze service worker uit
      await self.registration.unregister();

      // Herlaad alle open tabs
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

/* Vang alle requests af maar doe niets — ga direct naar netwerk */
self.addEventListener("fetch", (event) => {
  // Laat browser gewoon netwerk gebruiken
  return;
});