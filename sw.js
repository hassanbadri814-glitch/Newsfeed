/* ============================================================
   WAR DESK Service Worker v2.1
   - Network-first voor HTML/JS/CSS/JSON (updates komen door)
   - Cache-first voor images/fonts/icons (snelheid)
   - Fallback naar cache als netwerk faalt
   - FIX v2.1: precache alleen essentieel, versie gelijk aan app (B6+B18)
   ============================================================ */

const CACHE_NAME = 'wardesk-v14.18';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precache openen:', CACHE_NAME);
        return Promise.all(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Precache faalde voor', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => {
            console.log('[SW] Oude cache verwijderen:', n);
            return caches.delete(n);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    const isAsset = /fonts\.(googleapis|gstatic)\.com|unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com|tiles\.openfreemap\.org|basemaps\.cartocdn\.com/.test(url.host);
    if (!isAsset) return;
  }

  const isCode = /\.(html|js|css|json)$/i.test(url.pathname)
              || url.pathname === '/'
              || url.pathname.endsWith('/');

  if (isCode) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(req).then(r => r || caches.match('./index.html'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});