/* WAR DESK Service Worker v6 — vertaal-cache uitsluiten */
const CACHE_STATIC = "wardesk-static-v6";
const CACHE_RUNTIME = "wardesk-runtime-v6";
const MAX_RUNTIME_ENTRIES = 150;
const MAX_STATIC_ENTRIES = 40;
const ASSETS = ["./", "./index.html", "./manifest.json", "./icoon.svg"];

/* Fix L: sluit vertaal-API's uit van SW-caching (voorkomt dubbel cachen naast IDB) */
const SKIP_CACHE_HOSTS = [
  "translate.googleapis.com",
  "api.mymemory.translated.net"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC).then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => ![CACHE_STATIC, CACHE_RUNTIME].includes(k))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxItems){
  try{
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if(keys.length > maxItems){
      await cache.delete(keys[0]);
      return trimCache(cacheName, maxItems);
    }
  }catch(e){}
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    /* Fix L: skip vertaal-API's */
    if (SKIP_CACHE_HOSTS.some(h => url.hostname === h)) {
      /* Laat de browser het gewoon direct doen, geen SW-cache */
      return;
    }

    if (!url.protocol.startsWith("http")) return;

    e.respondWith(
      caches.open(CACHE_RUNTIME).then(cache =>
        cache.match(req).then(cached => {
          const fetchPromise = fetch(req).then(res => {
            if (res && res.status === 200 && res.type !== "opaqueredirect") {
              cache.put(req, res.clone())
                .then(() => trimCache(CACHE_RUNTIME, MAX_RUNTIME_ENTRIES))
                .catch(() => {});
            }
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c =>
            c.put(req, clone)
              .then(() => trimCache(CACHE_STATIC, MAX_STATIC_ENTRIES))
              .catch(() => {})
          ).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 503 });
      });
    })
  );
});

self.addEventListener("message", e => {
  const data = e.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "CLEAR_CACHE") {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (e.ports && e.ports[0]) e.ports[0].postMessage({ ok: true });
        })
    );
  }
});