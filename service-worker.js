/* ==========================================================
   WAR DESK Service Worker v5
   Cache-limieten · Stale-while-revalidate · Offline fallback
   ========================================================== */

const CACHE_STATIC = "wardesk-static-v5";
const CACHE_RUNTIME = "wardesk-runtime-v5";
const MAX_RUNTIME_ENTRIES = 150;
const MAX_STATIC_ENTRIES = 40;
const ASSETS = ["./", "./index.html", "./manifest.json", "./icoon.svg"];

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

/* ============ FETCH STRATEGIE ============ */
self.addEventListener("fetch", e => {
  const req = e.request;

  /* Alleen GET requests cachen */
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* ── EXTERNE REQUESTS (feeds, API, fonts, CDN) ── */
  /* Strategie: stale-while-revalidate
     - Toon direct uit cache (snel)
     - Update op achtergrond (vers) */
  if (url.origin !== self.location.origin) {
    /* Skip requests met non-http(s) protocol (chrome-extension etc.) */
    if (!url.protocol.startsWith("http")) return;

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

  /* ── EIGEN BESTANDEN (index.html, manifest, icoon) ── */
  /* Strategie: cache-first, dan network
     - Snel bij herhaald bezoek
     - Fallback naar index.html bij offline navigatie */
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req)
        .then(res => {
          /* Alleen eigen, geldige responses cachen */
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
          /* Offline fallback voor navigatie → index.html */
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          /* Voor andere requests: lege 503 response */
          return new Response("", { status: 503, statusText: "Offline" });
        });
    })
  );
});

/* ============ MESSAGE HANDLER ============ */
/* Laat de pagina toe om de SW te vragen om te updaten of cache te wissen */
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
/* Momenteel niet actief, maar klaar voor toekomstig gebruik */
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