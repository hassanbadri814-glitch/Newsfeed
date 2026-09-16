/* ==========================================================
   WAR DESK Service Worker v17.6
   Cache-versie gematcht met index.html v17.6
   Vertaal-API's worden NIET gecached (voorkomt dubbele opslag)
   ========================================================== */

const CACHE_STATIC = "wardesk-static-v17_6";
const CACHE_RUNTIME = "wardesk-runtime-v17_6";
const MAX_RUNTIME_ENTRIES = 150;
const MAX_STATIC_ENTRIES = 40;
const ASSETS = ["./", "./index.html", "./manifest.json", "./icoon.svg"];

/* Vertaal-API's uitsluiten van service worker caching */
const SKIP_CACHE_HOSTS = [
  "translate.googleapis.com",
  "api.mymemory.translated.net"
];

/* ============ INSTALL ============ */
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

/* ============ ACTIVATE ============ */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ============ CACHE TRIMMEN ============ */
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

/* ============ FETCH ============ */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Skip vertaal-API's — laat browser direct gaan */
  if (SKIP_CACHE_HOSTS.some(h => url.hostname === h)) {
    return;
  }

  /* Skip non-http(s) protocols */
  if (!url.protocol.startsWith("http")) return;

  /* ── EXTERNE REQUESTS (feeds, fonts, CDN) ── */
  /* Stale-while-revalidate */
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.open(CACHE_RUNTIME).then(cache =>
        cache.match(req).then(cached => {
          const fetchPromise = fetch(req)
            .then(res => {
              if (res && res.status === 200 && res.type !== "opaqueredirect") {
                cache.put(req, res.clone())
                  .then(() => trimCache(CACHE_RUNTIME, MAX_RUNTIME_ENTRIES))
                  .catch(() => {});
              }
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  /* ── EIGEN BESTANDEN ── */
  /* Cache-first, network fallback */
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_STATIC)
              .then(c => c.put(req, clone)
                .then(() => trimCache(CACHE_STATIC, MAX_STATIC_ENTRIES))
                .catch(() => {})
              )
              .catch(() => {});
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 503, statusText: "Offline" });
        });
    })
  );
});

/* ============ MESSAGE HANDLER ============ */
self.addEventListener("message", e => {
  const data = e.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (data.type === "CLEAR_CACHE") {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (e.ports && e.ports[0]) {
            e.ports[0].postMessage({ ok: true });
          }
        })
    );
  }
});

/* ============ PUSH NOTIFICATIONS (voorbereiding) ============ */
self.addEventListener("push", e => {
  if (!e.data) return;
  let payload = {};
  try {
    payload = e.data.json();
  } catch (err) {
    payload = { title: "WAR DESK", body: e.data.text() };
  }
  const title = payload.title || "WAR DESK";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "./icoon.svg",
    badge: "./icoon.svg",
    tag: payload.tag || "wardesk",
    data: payload.data || {}
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});